import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CronService } from './cron.service';
import { DbModule } from "@libs/db";
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        DbModule,
        ScheduleModule.forRoot(),
    ],
    providers: [CronService],
})
export class CronModule {}
