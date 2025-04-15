import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiService } from './api.service';
import { MongooseModule } from '@nestjs/mongoose';
import { DbModule } from '@libs/db';
import { ApiController } from "./api.controller";
import { SlackModule } from '@libs/common';
import { GmailToken, GmailTokenSchema } from '@libs/db/schemas/gmail-token.schema';
import { TransactionAttachment, TransactionAttachmentSchema } from '@libs/db/schemas/transaction-attachment.schema';


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/dbname'),
        MongooseModule.forFeature([
            {
                name: GmailToken.name,
                schema: GmailTokenSchema,
                collection: 'gmail_token',
            },
            {
                name: TransactionAttachment.name,
                schema: TransactionAttachmentSchema,
                collection: 'transaction_attachment',
            },
        ]),
        DbModule,
        SlackModule,
    ],
    controllers: [ApiController],
    providers: [ApiService],
})
export class ApiModule {}
