import { NestFactory } from '@nestjs/core';
import { ApiModule } from './api.module';

async function bootstrap() {
    const app = await NestFactory.create(ApiModule);
    
    // CORS 설정 추가
    app.enableCors({
        origin: ['http://localhost:3001'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
    });
    
    await app.listen(3000);
}
bootstrap();
