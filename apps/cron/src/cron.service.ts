import {Injectable, Logger} from "@nestjs/common";
import { Cron, CronExpression } from '@nestjs/schedule';
import { google } from 'googleapis';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import * as puppeteer from 'puppeteer-core';
import { getPeriodFromDate } from '@libs/common/utils/date-utils';
import { SlackService } from '@libs/common';

import {
    TransactionAttachment,
    TransactionAttachmentDocument,
} from '@libs/db/schemas/transaction-attachment.schema';

import {
    GmailToken,
    GmailTokenDocument,
} from "@libs/db/schemas/gmail-token.schema";

import {
    GmailSyncState,
    GmailSyncStateDocument,
} from "@libs/db/schemas/gmail-sync-state.schema";

import {
    LocalParseState,
    LocalParseStateDocument,
} from '@libs/db/schemas/local-parse-state.schema';

import {
    TransactionDeposit,
    TransactionDepositDocument,
} from '@libs/db/schemas/transaction-deposit.schema';

import {
    BananaUnitPrice,
    BananaUnitPriceDocument,
} from '@libs/db/schemas/banana-unit-price.schema';

import {
    SubscriptionUser,
    SubscriptionUserDocument,
} from '@libs/db/schemas/subscription-user.schema';

import {
    BananaSettlement,
    BananaSettlementDocument,
} from '@libs/db/schemas/banana-settlement.schema';

function parseDateFromFilename(fileName: string): Date {
    const match = fileName.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.html$/);
    if (!match) {
        return new Date(); // fallback
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = parseInt(match[6], 10);

    return new Date(year, month - 1, day, hour, minute, second);
}

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);

    private oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
    );

    constructor(
        @InjectModel(TransactionAttachment.name)
        private readonly attachModel: Model<TransactionAttachmentDocument>,

        @InjectModel(GmailToken.name)
        private readonly gmailTokenModel: Model<GmailTokenDocument>,

        @InjectModel(GmailSyncState.name)
        private readonly gmailSyncStateModel: Model<GmailSyncStateDocument>,

        @InjectModel(LocalParseState.name)
        private readonly parseStateModel: Model<LocalParseStateDocument>,

        @InjectModel(TransactionDeposit.name)
        private readonly depositModel: Model<TransactionDepositDocument>,

        @InjectModel(BananaUnitPrice.name)
        private readonly unitPriceModel: Model<BananaUnitPriceDocument>,

        @InjectModel(SubscriptionUser.name)
        private readonly userModel: Model<SubscriptionUserDocument>,

        @InjectModel(BananaSettlement.name)
        private readonly settlementModel: Model<BananaSettlementDocument>,

        private readonly slackService: SlackService,
    ) {}

    async fetchTransactionMails() {
        this.logger.log('Start fetching mails with attachment...');

        try {
            const tokenDoc = await this.gmailTokenModel.findOne().exec();
            if (!tokenDoc) {
                this.logger.error('No Gmail token found in DB. Cannot proceed.');
                return;
            }


            this.oauth2Client.setCredentials({
                access_token: tokenDoc.accessToken,
                refresh_token: tokenDoc.refreshToken,
                scope: tokenDoc.scope,
                token_type: tokenDoc.tokenType,
                expiry_date: tokenDoc.expiryDate,
            });

            const now = Date.now();
            const expiryDate = tokenDoc.expiryDate || 0;
            if (now >= expiryDate - 60_000) {
                this.logger.log('Access token expired or near expiry. Refreshing...');

                const { credentials } = await this.oauth2Client.refreshAccessToken();

                if(!credentials.access_token){
                    this.logger.error('No exist access token');
                    return;
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

                this.logger.log('Refreshed access token successfully.');
            }

            let syncState = await this.gmailSyncStateModel.findOne({ key: 'default' }).exec();
            if (!syncState) {
                syncState = new this.gmailSyncStateModel({
                    key: 'default',
                    lastSyncedDate: new Date('2025-02-03T00:00:00'),
                });
                await syncState.save();
            }

            const lastSyncDate = syncState.lastSyncedDate  ?? new Date('2025-02-03T00:00:00');
            const afterStr = this.formatDateForGmailQuery(lastSyncDate);

            const query = `subject:"농협에서 제공하는 입출금 거래내역 입니다." has:attachment after:${afterStr}`;
            this.logger.log(`Using query = ${query}`);

            const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
            let nextPageToken: string | undefined;
            let totalFetched = 0;

            let maxReceivedDate = lastSyncDate;

            do {
                const listRes = await gmail.users.messages.list({
                    userId: 'me',
                    q: query,
                    pageToken: nextPageToken,
                    maxResults: 10,
                });

                const messages = listRes.data.messages || [];
                this.logger.log(`Found ${messages.length} messages this page.`);

                for (const msg of messages) {
                    const exists = await this.attachModel.exists({ messageId: msg.id });
                    if (exists) {
                        continue;
                    }

                    const msgRes = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id!,
                    });

                    const payload = msgRes.data.payload;
                    if (!payload) continue;

                    const headers = payload.headers || [];
                    const subject = headers.find(h => h.name === 'Subject')?.value || '';
                    const from = headers.find(h => h.name === 'From')?.value || '';
                    const dateStr = headers.find(h => h.name === 'Date')?.value || '';
                    const receivedDate = dateStr ? new Date(dateStr) : new Date();

                    if (receivedDate > maxReceivedDate) {
                        maxReceivedDate = receivedDate;
                    }

                    const parts = payload.parts || [];
                    for (const part of parts) {
                        if (part.filename && part.body?.attachmentId) {
                            const attachRes = await gmail.users.messages.attachments.get({
                                userId: 'me',
                                messageId: msg.id!,
                                id: part.body.attachmentId,
                            });
                            const attachmentData = attachRes.data.data;

                            if (!attachmentData) continue;

                            const buffer = this.decodeBase64(attachmentData);

                            const dataDir = path.join(process.cwd(), 'data');
                            if (!fs.existsSync(dataDir)) {
                                fs.mkdirSync(dataDir, { recursive: true });
                            }

                            const baseName = format(receivedDate, 'yyyyMMddHHmmss');
                            const ext = this.getExtensionFromFilename(part.filename)
                                || this.getExtensionFromMimeType(part.mimeType || '');
                            let finalName = baseName + (ext ? '.' + ext : '');
                            let finalPath = path.join(dataDir, finalName);

                            let counter = 1;
                            while (fs.existsSync(finalPath)) {
                                finalName = `${baseName}_${counter}${ext ? '.' + ext : ''}`;
                                finalPath = path.join(dataDir, finalName);
                                counter++;
                            }

                            fs.writeFileSync(finalPath, buffer);

                            const attachDoc = new this.attachModel({
                                messageId: msg.id,
                                subject,
                                from,
                                receivedDate,
                                filename: finalName,
                                filePath: `data/${finalName}`,
                                mimeType: part.mimeType,
                            });
                            await attachDoc.save();

                            totalFetched++;
                            this.logger.log(`Saved attachment => ${finalName}`);
                        }
                    }
                }

                nextPageToken = listRes.data.nextPageToken || undefined;
            } while (nextPageToken);

            this.logger.log(`총 ${totalFetched}건의 첨부파일을 다운로드했습니다.`);
        } catch (error) {
            let errMsg = 'unknown error';
            let errStack = 'unknown stack';
            if (error instanceof Error) {
                errMsg = error.message;
                errStack = error.stack || '';
            }
            this.logger.error(`Error fetching attachments: ${errMsg}`, errStack);
        }
    }

    private formatDateForGmailQuery(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    }

    private decodeBase64(base64url?: string): Buffer {
        if (!base64url) return Buffer.from([]);
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64');
    }

    private getExtensionFromFilename(filename: string): string {
        const splitted = filename.split('.');
        if (splitted.length < 2) return '';
        return splitted[splitted.length - 1];
    }

    private getExtensionFromMimeType(mime: string): string {
        const slashIndex = mime.indexOf('/');
        if (slashIndex === -1) return '';
        return mime.substring(slashIndex + 1);
    }

    async parseLocalHtmlFiles() {
        this.logger.log('Start parsing local HTML files in data/ ...');

        try {
            let parseState = await this.parseStateModel.findOne({ key: 'default' }).exec();
            if (!parseState) {
                parseState = new this.parseStateModel({
                    key: 'default',
                    lastFileName: '',
                });
                await parseState.save();
            }

            const lastFileName = parseState.lastFileName || '';

            const dataDir = path.join(process.cwd(), 'data');
            if (!fs.existsSync(dataDir)) {
                this.logger.warn('data directory does not exist. Nothing to parse.');
                return;
            }

            const files = fs.readdirSync(dataDir)
                .filter((f) => f.endsWith('.html'))
                .sort();

            const newFiles = files.filter(f => f > lastFileName);

            if (newFiles.length === 0) {
                this.logger.log(`No new HTML files to parse. Last: ${lastFileName}`);
                return;
            }

            this.logger.log(`Found ${newFiles.length} new files to parse`);

            const browser = await puppeteer.launch({
                executablePath: '/usr/bin/chromium',
                headless: true,
                protocolTimeout: 60000,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-zygote',
                    '--single-process',
                ],
            });

            let lastProcessedFile = lastFileName;

            for (const fileName of newFiles) {
                const filePath = `file://${path.join(dataDir, fileName)}`;
                this.logger.log(`Parsing file: ${fileName}`);

                const depositTime = parseDateFromFilename(fileName);

                const extracted = await this.parseSingleHtml(browser, filePath);

                this.logger.log(`Parsed result = ${JSON.stringify(extracted)}`);

                const rawMoney = extracted.inputMoney || '';
                const amountStr = rawMoney.replace(/,/g, '').replace(/원/g, '');
                const amount = parseInt(amountStr, 10) || 0;

                const depositorName = extracted.depositorName || 'unknown';

                const doc = new this.depositModel({
                    depositTime,
                    depositorName,
                    amount,
                });
                await doc.save();

                this.logger.log(`Saved deposit record: ${JSON.stringify(doc)}`);

                lastProcessedFile = fileName;
            }

            await browser.close();

            parseState.lastFileName = lastProcessedFile;
            await parseState.save();

            this.logger.log(`Updated lastFileName = ${lastProcessedFile}`);
        } catch (error) {
            let errMsg = 'unknown error';
            let errStack = 'unknown stack';
            if (error instanceof Error) {
                errMsg = error.message;
                errStack = error.stack || '';
            }
            this.logger.error(`Error in parseLocalHtmlFiles: ${errMsg}`, errStack);
        }
    }

    private async parseSingleHtml(browser: puppeteer.Browser, filePath: string) {
        const page = await browser.newPage();

        await page.goto(filePath, { waitUntil: 'networkidle0' });

        await page.waitForFunction(() => typeof (window as any).doAction === 'function');

        const passwordValue = process.env.FILE_PASSWORD || 'file_password';

        await page.evaluate((pw) => {
            const element = document.getElementById('password') as HTMLInputElement;
            if (element) {
                element.value = pw;
                (window as any).doAction();
            }
        }, passwordValue);

        await page.waitForSelector('.static_body');

        const extractedData = await page.evaluate(() => {
            const inputMoneyElement = document.querySelectorAll('.dynamic_body')[3] as HTMLElement;
            const depositorNameElement = document.querySelectorAll('.dynamic_body')[7] as HTMLElement;

            const inputMoney = inputMoneyElement ? inputMoneyElement.innerText : '';
            const depositorName = depositorNameElement ? depositorNameElement.innerText : '';

            return {
                depositorName,
                inputMoney,
            };
        });

        await page.close();
        return extractedData;
    }

    async checkBananaSettlements() {
        this.logger.log('Start checking banana settlements...');

        const allDeposits = await this.depositModel.find().exec();
        this.logger.log(`Found ${allDeposits.length} deposits.`);

        for (const deposit of allDeposits) {
            const userName = deposit.depositorName || '';
            const depositTime = deposit.depositTime;
            const depositAmount = deposit.amount || 0;

            if (!userName || !depositTime) {
                continue;
            }

            const period = getPeriodFromDate(depositTime);
            if (!period) {
                this.logger.warn(
                    `Deposit on weekend or no matching period => depositTime=${depositTime}`,
                );
                continue;
            }

            const unitPriceDoc = await this.unitPriceModel.findOne({ period }).exec();
            if (!unitPriceDoc) {
                this.logger.warn(`No unitPrice found for period=${period}`);
                continue;
            }
            const unitPrice = unitPriceDoc.unitPrice || 0;

            const subscriptionDoc = await this.userModel.findOne({ name: userName }).exec();
            if (!subscriptionDoc) {
                this.logger.warn(`No subscription user found for name=${userName}`);
                continue;
            }
            const quantity = subscriptionDoc.quantity || 0;

            const requiredAmount = unitPrice * quantity;

            const isSettled = depositAmount >= requiredAmount;

            // 정산 정보 업데이트 또는 생성
            const settlementDoc = await this.settlementModel.findOneAndUpdate(
                { userName, period },
                {
                    userName,
                    period,
                    depositTime,
                    depositAmount,
                    requiredAmount,
                    isSettled,
                },
                { upsert: true, new: true },
            );

            this.logger.log(`Settle: ${userName}/${period} deposit=${depositAmount} needed=${requiredAmount} => isSettled=${isSettled}`);

            try {
                // 해당 기간의 정산 메시지 찾기
                const settlementMessage = await this.slackService.findSettlementMessageByPeriod(period);
                
                if (settlementMessage && settlementMessage.ts && settlementMessage.channel) {
                    // 입금 완료 메시지 전송
                    await this.slackService.sendPaymentConfirmation(
                        userName,
                        settlementMessage.ts,
                        settlementMessage.channel
                    );
                    
                    // 알림 전송 상태 업데이트
                    await this.settlementModel.updateOne(
                        { _id: settlementDoc._id },
                        { notificationSent: true }
                    );
                    
                    this.logger.log(`Payment confirmation sent for ${userName} in period ${period}`);
                } else {
                    this.logger.warn(`Settlement message not found for period ${period}`);
                }
            } catch (error) {
                this.logger.error(`Failed to send payment confirmation for ${userName}`, error);
            }
        }

        this.logger.log('Banana settlement check done.');
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async allInOneJob() {
        await this.fetchTransactionMails();
        await this.parseLocalHtmlFiles();
        await this.checkBananaSettlements();
    }

    /**
     * 매주 월요일 오전 9시 30분에 바나나 정산 메시지 전송
     * 크론 표현식: 0 30 9 * * 1 (초 분 시 일 월 요일)
     */
    @Cron('0 30 9 * * 1')
    async sendWeeklyBananaSettlementNotice() {
        this.logger.log('주간 바나나 정산 메시지 전송 작업 시작');
        
        try {
            // 슬랙 채널 ID를 환경 변수에서 가져오기
            const channelId = process.env.SLACK_CHANNEL_ID;
            
            if (!channelId) {
                throw new Error('SLACK_CHANNEL_ID 환경 변수가 설정되지 않았습니다.');
            }
            
            // 바나나 정산 메시지 전송
            const response = await this.slackService.sendBananaSettlementMessage(channelId);
            
            this.logger.log(`바나나 정산 메시지 전송 성공: ts=${response.ts}, channel=${channelId}`);
        } catch (error) {
            let errMsg = 'unknown error';
            if (error instanceof Error) {
                errMsg = error.message;
            }
            this.logger.error(`바나나 정산 메시지 전송 실패: ${errMsg}`, error);
        }
    }
}
