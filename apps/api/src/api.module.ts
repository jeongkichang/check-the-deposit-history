import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiService } from './api.service';
import { MongooseModule } from '@nestjs/mongoose';
import { DbModule } from '@libs/db';
import { ApiController } from "./api.controller";
import { SlackService } from "@libs/slack";


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/dbname'),
        DbModule,
    ],
    controllers: [ApiController],
    providers: [ApiService, SlackService],
})
export class ApiModule {}
