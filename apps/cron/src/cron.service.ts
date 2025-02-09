import {Injectable, Logger} from "@nestjs/common";
// 크론은 일단 대기
// import { Cron, CronExpression } from '@nestjs/schedule';
import { google } from 'googleapis';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';

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
    GmailSyncStateDocument
} from "@libs/db/schemas/gmail-sync-state.schema";

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
                // 테스트 할 때까지는 대기
                // await syncState.save();
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
                            // 테스트 할 때 까지 대기
                            // await attachDoc.save();

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
}
