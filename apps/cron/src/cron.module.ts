import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CronService } from './cron.service';
import { DbModule } from "@libs/db/db.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        DbModule,
    ],
    providers: [CronService],
})
export class CronModule {}
