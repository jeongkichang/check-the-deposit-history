import { Controller, Get, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { google } from 'googleapis';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    GmailToken,
    GmailTokenDocument,
} from '@libs/db/schemas/gmail-token.schema';
import { ApiService } from "./api.service";
import { SlackService } from "@libs/common/slack";
import { getPeriodFromDate } from '@libs/common/utils/date-utils'; 
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import {
    TransactionAttachment,
    TransactionAttachmentDocument,
} from '@libs/db/schemas/transaction-attachment.schema';

@Controller('api')
export class ApiController {
    private readonly logger = new Logger(ApiController.name);

    private oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
    );

    constructor(
        @InjectModel(GmailToken.name)
        private readonly gmailTokenModel: Model<GmailTokenDocument>,

        @InjectModel(TransactionAttachment.name)
        private readonly attachModel: Model<TransactionAttachmentDocument>,

        private readonly apiService: ApiService,
        private readonly slackService: SlackService,
    ) {}

    @Get('fetch-latest-transaction')
    async fetchLatestTransaction(@Res() res: Response) {
        this.logger.log('가장 최근 입출금 내역 이메일 조회 시작');

        try {
            // 1. Gmail 토큰 가져오기
            const tokenDoc = await this.gmailTokenModel.findOne().exec();
            if (!tokenDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Gmail 토큰이 없습니다. 먼저 인증을 진행해주세요.',
                });
            }

            // 2. 인증 설정
            this.oauth2Client.setCredentials({
                access_token: tokenDoc.accessToken,
                refresh_token: tokenDoc.refreshToken,
                scope: tokenDoc.scope,
                token_type: tokenDoc.tokenType,
                expiry_date: tokenDoc.expiryDate,
            });

            // 3. 토큰 만료 체크 및 갱신
            const now = Date.now();
            const expiryDate = tokenDoc.expiryDate || 0;
            if (now >= expiryDate - 60_000) {
                this.logger.log('Access token 만료 또는 만료 임박. 갱신 중...');

                try {
                    const { credentials } = await this.oauth2Client.refreshAccessToken();

                    if (!credentials.access_token) {
                        return res.status(500).json({
                            success: false,
                            message: '액세스 토큰 갱신 실패',
                        });
                    }

                    tokenDoc.accessToken = credentials.access_token;
                    tokenDoc.refreshToken = credentials.refresh_token || tokenDoc.refreshToken;
                    tokenDoc.scope = credentials.scope || tokenDoc.scope;
                    tokenDoc.tokenType = credentials.token_type || tokenDoc.tokenType;
                    tokenDoc.expiryDate = credentials.expiry_date || tokenDoc.expiryDate;
                    await tokenDoc.save();

                    this.oauth2Client.setCredentials({
                        access_token: tokenDoc.accessToken,
                        refresh_token: tokenDoc.refreshToken,
                        scope: tokenDoc.scope,
                        token_type: tokenDoc.tokenType,
                        expiry_date: tokenDoc.expiryDate,
                    });

                    this.logger.log('액세스 토큰 갱신 성공');
                } catch (error) {
                    this.logger.error('토큰 갱신 중 오류 발생', error);
                    return res.status(500).json({
                        success: false,
                        message: '토큰 갱신 실패',
                        error: error instanceof Error ? error.message : '알 수 없는 오류',
                    });
                }
            }

            // 4. Gmail API 초기화
            const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

            // 5. 입출금 내역 관련 이메일 검색 (최신 1개만)
            const query = `subject:"농협에서 제공하는 입출금 거래내역 입니다." has:attachment`;
            const listRes = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: 1,
            });

            const messages = listRes.data.messages || [];
            if (messages.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '입출금 내역 이메일을 찾을 수 없습니다.',
                });
            }

            // 6. 이메일 정보 가져오기
            const message = messages[0];
            const msgRes = await gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
            });

            const payload = msgRes.data.payload;
            if (!payload) {
                return res.status(404).json({
                    success: false,
                    message: '이메일 내용을 찾을 수 없습니다.',
                });
            }

            // 7. 이메일 헤더 정보 추출
            const headers = payload.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const dateStr = headers.find(h => h.name === 'Date')?.value || '';
            const receivedDate = dateStr ? new Date(dateStr) : new Date();

            // 8. 첨부파일 다운로드
            const parts = payload.parts || [];
            const attachments = [];

            for (const part of parts) {
                if (part.filename && part.body?.attachmentId) {
                    const attachRes = await gmail.users.messages.attachments.get({
                        userId: 'me',
                        messageId: message.id!,
                        id: part.body.attachmentId,
                    });
                    const attachmentData = attachRes.data.data;

                    if (!attachmentData) continue;

                    // 첨부파일 디코딩
                    const buffer = this.decodeBase64(attachmentData);

                    // 디렉토리 생성
                    const dataDir = path.join(process.cwd(), 'data');
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }

                    // 파일명 생성
                    const baseName = format(receivedDate, 'yyyyMMddHHmmss');
                    const ext = this.getExtensionFromFilename(part.filename)
                        || this.getExtensionFromMimeType(part.mimeType || '');
                    let finalName = baseName + (ext ? '.' + ext : '');
                    let finalPath = path.join(dataDir, finalName);

                    // 파일명 중복 방지
                    let counter = 1;
                    while (fs.existsSync(finalPath)) {
                        finalName = `${baseName}_${counter}${ext ? '.' + ext : ''}`;
                        finalPath = path.join(dataDir, finalName);
                        counter++;
                    }

                    // 파일 저장
                    fs.writeFileSync(finalPath, buffer);

                    // DB에 첨부파일 정보 저장
                    const attachDoc = new this.attachModel({
                        messageId: message.id,
                        subject,
                        from,
                        receivedDate,
                        filename: finalName,
                        filePath: `data/${finalName}`,
                        mimeType: part.mimeType,
                    });
                    await attachDoc.save();

                    attachments.push({
                        filename: finalName,
                        filePath: `data/${finalName}`,
                        mimeType: part.mimeType,
                    });

                    this.logger.log(`첨부파일 저장 성공: ${finalName}`);
                }
            }

            // 9. 응답 반환
            return res.status(200).json({
                success: true,
                message: '최신 입출금 내역 이메일 처리 완료',
                email: {
                    id: message.id,
                    subject,
                    from,
                    receivedDate,
                },
                attachments,
            });
        } catch (error) {
            this.logger.error('입출금 내역 이메일 처리 중 오류 발생', error);
            return res.status(500).json({
                success: false,
                message: '입출금 내역 이메일 처리 중 오류 발생',
                error: error instanceof Error ? error.message : '알 수 없는 오류',
            });
        }
    }

    // Base64 디코딩 유틸리티 함수
    private decodeBase64(base64url?: string): Buffer {
        if (!base64url) return Buffer.from([]);
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64');
    }

    // 파일명에서 확장자 추출 함수
    private getExtensionFromFilename(filename: string): string {
        const splitted = filename.split('.');
        if (splitted.length < 2) return '';
        return splitted[splitted.length - 1];
    }

    // MIME 타입에서 확장자 추출 함수
    private getExtensionFromMimeType(mime: string): string {
        const slashIndex = mime.indexOf('/');
        if (slashIndex === -1) return '';
        return mime.substring(slashIndex + 1);
    }

    @Get('gmail/auth')
    async authGmail(
        @Res() res: Response,
    ) {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/user.birthday.read',
        ];

        const url = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
        });

        return res.redirect(url);
    }

    @Get('gmail/callback')
    async gmailCallback(@Req() req: Request, @Res() res: Response) {
        const code = req.query.code as string;
        if (!code) {
            return res.status(400).json({ message: 'No code found' });
        }

        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            if (!tokens.access_token) {
                return res.status(400).json({ message: 'Failed to get access token.' });
            }

            this.oauth2Client.setCredentials(tokens);

            const people = google.people({ version: 'v1', auth: this.oauth2Client });
            const response = await people.people.get({
                resourceName: 'people/me',
                personFields: 'names,birthdays,emailAddresses',
            });

            const userData = response.data;
            const names = userData.names;
            const displayName = names?.[0]?.displayName;
            const birthdays = userData.birthdays;
            const birthday = birthdays?.[0]?.date;
            const emails = userData.emailAddresses;
            const email = emails?.[0]?.value;

            if(displayName !== process.env.GMAIL_USER_NAME){
                return res.status(403).json({
                    message: '허용되지 않은 사용자입니다. 이름이 일치하지 않습니다.',
                    userName: displayName,
                });
            }

            const tokenDoc = new this.gmailTokenModel({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                scope: tokens.scope,
                tokenType: tokens.token_type,
                expiryDate: tokens.expiry_date,
                name: displayName,
                birthday,
                email,
            });
            await tokenDoc.save();

            return res.json({
                message: '토큰 & 사용자 프로필 조회 성공',
                tokens,
                profile: {
                    name: displayName,
                    birthday: birthday,
                    email,
                },
            });
        } catch (error) {
            let errMsg = 'unknown error';
            if (error instanceof Error) {
                errMsg = error.message;
            }
            return res.status(500).json({
                message: '구글 인증 콜백 처리 중 에러 발생',
                error: errMsg,
            });
        }
    }

    @Get('settlement/:period?')
    async checkSettlement(@Param('period') period?: string) {
        this.logger.log(`checkSettlement called. period param = ${period}`);

        if (!period) {
            const now = new Date();
            period = getPeriodFromDate(now);
            if (!period) {
                return {
                    message: '주말이거나 해당 주차를 계산할 수 없습니다.',
                    date: now.toString(),
                };
            }
        }

        return await this.apiService.getSettlementStatusForPeriod(period);
    }

    @Get('test-slack')
    async testSlackEndpoint() {
        try {
            const message = '안녕하세요! 이 메시지는 NestJS ApiController에서 Slack으로 보낸 테스트 알람입니다.';
            await this.slackService.postMessageToChannel(message, process.env.SLACK_CHANNEL_ID as string);

            return {
                message: 'Slack 메시지를 성공적으로 전송했습니다.',
                content: message,
            };
        } catch (error) {
            let errMsg = 'unknown error';
            if (error instanceof Error) {
                errMsg = error.message;
            }
            this.logger.error('Slack 전송 실패', error);
            return {
                error: errMsg || 'Slack 전송 중 알 수 없는 오류가 발생했습니다.',
            };
        }
    }

    @Get('test-thread')
    async testThread(
        @Query('channel') channel: string,
        @Query('parentTs') parentTs: string,
    ) {
        const text = '이 메시지는 테스트 스레드 답글입니다 (DB 로깅).';
        const result = await this.slackService.postThreadMessage(
            text,
            channel,
            parentTs,
        );

        return {
            message: 'Slack 스레드 메시지 전송 성공',
            response: result,
        };
    }

    @Get('send-banana-notice')
    async sendBananaNotice() {
        try {
            // 슬랙 채널 ID를 환경 변수에서 가져오기
            const channelId = process.env.SLACK_CHANNEL_ID;
            
            if (!channelId) {
                throw new Error('SLACK_CHANNEL_ID 환경 변수가 설정되지 않았습니다.');
            }
            
            // 바나나 정산 메시지 전송
            const response = await this.slackService.sendBananaSettlementMessage(channelId);
            
            return {
                message: '바나나 정산 메시지를 성공적으로 전송했습니다.',
                ts: response.ts,
                channel: channelId
            };
        } catch (error) {
            let errMsg = 'unknown error';
            if (error instanceof Error) {
                errMsg = error.message;
            }
            this.logger.error('바나나 정산 메시지 전송 실패', error);
            return {
                error: errMsg || '바나나 정산 메시지 전송 중 알 수 없는 오류가 발생했습니다.',
            };
        }
    }
}
