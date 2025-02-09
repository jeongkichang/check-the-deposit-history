import { NestFactory } from '@nestjs/core';
import { CronModule } from './cron.module';
import { CronService } from "./cron.service";

async function bootstrap() {
    const app = await NestFactory.create(CronModule);
    await app.init();

    // const cronService = app.get(CronService);
    // await cronService.fetchTransactionMails();
}
bootstrap();
