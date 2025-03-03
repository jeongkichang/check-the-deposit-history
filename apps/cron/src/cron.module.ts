import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CronService } from './cron.service';
import { DbModule } from "@libs/db";
import { ScheduleModule } from '@nestjs/schedule';
import { SlackModule } from '@libs/common';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        DbModule,
        ScheduleModule.forRoot(),
        SlackModule,
    ],
    providers: [CronService],
})
export class CronModule {}
