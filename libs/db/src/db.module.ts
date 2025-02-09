import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GmailToken, GmailTokenSchema } from "@libs/db/schemas/gmail-token.schema";

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
                collection: 'gmail_token'
            },
        ]),
    ],
    exports: [
        MongooseModule,
    ],
})
export class DbModule {}
