import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GmailToken, GmailTokenSchema } from "@libs/db/schemas/gmail-token.schema";
import { GmailSyncState, GmailSyncStateSchema } from "@libs/db/schemas/gmail-sync-state.schema";
import { TransactionAttachment, TransactionAttachmentSchema } from "@libs/db/schemas/transaction-attachment.schema";
import { LocalParseState, LocalParseStateSchema } from "@libs/db/schemas/local-parse-state.schema";
import { TransactionDeposit, TransactionDepositSchema } from "@libs/db/schemas/transaction-deposit.schema";
import { SubscriptionUser, SubscriptionUserSchema } from "@libs/db/schemas/subscription-user.schema";
import { BananaUnitPrice, BananaUnitPriceSchema } from "@libs/db/schemas/banana-unit-price.schema";
import { BananaSettlement, BananaSettlementSchema } from "@libs/db/schemas/banana-settlement.schema";
import { SlackMessage, SlackMessageSchema } from './schemas/slack-message.schema';

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
            {
                name: LocalParseState.name,
                schema: LocalParseStateSchema,
                collection: 'local_parse_state',
            },
            {
                name: TransactionDeposit.name,
                schema: TransactionDepositSchema,
                collection: 'transaction_deposit',
            },
            {
                name: SubscriptionUser.name,
                schema: SubscriptionUserSchema,
                collection: 'subscription_user',
            },
            {
                name: BananaUnitPrice.name,
                schema: BananaUnitPriceSchema,
                collection: 'banana_unit_price',
            },
            {
                name: BananaSettlement.name,
                schema: BananaSettlementSchema,
                collection: 'banana_settlement',
            },
            {
                name: SlackMessage.name,
                schema: SlackMessageSchema,
                collection: 'slack_message',
            },
        ]),
    ],
    exports: [
        MongooseModule,
    ],
})
export class DbModule {}
