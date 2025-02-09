import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GmailToken, GmailTokenSchema } from "@libs/db/schemas/gmail-token.schema";
import { GmailSyncState, GmailSyncStateSchema } from "@libs/db/schemas/gmail-sync-state.schema";
import { TransactionAttachment, TransactionAttachmentSchema } from "@libs/db/schemas/transaction-attachment.schema";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>('MONGO_URI') || 'mongodb://localhost:27017/dbname',
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forFeature([
            {
                name: GmailToken.name,
                schema: GmailTokenSchema,
                collection: 'gmail_token',
            },
            {
                name: GmailSyncState.name,
                schema: GmailSyncStateSchema,
                collection: 'gmail_sync_state',
            },
            {
                name: TransactionAttachment.name,
                schema: TransactionAttachmentSchema,
                collection: 'transaction_attachment',
            },
        ]),
    ],
    exports: [
        MongooseModule,
    ],
})
export class DbModule {}
