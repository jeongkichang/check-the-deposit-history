import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiService } from './api.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
    ],
    providers: [ApiService],
})
export class ApiModule {}
