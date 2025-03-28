import { NestFactory } from '@nestjs/core';
import { CronModule } from './cron.module';

async function bootstrap() {
    const app = await NestFactory.create(CronModule);
    await app.init();
}
bootstrap();
