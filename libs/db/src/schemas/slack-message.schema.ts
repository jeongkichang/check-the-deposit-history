import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class SlackMessage {
    // 실제 전송한 메시지 내용
    @Prop({ required: true })
    text?: string;

    // 메시지를 보낸 채널 ID
    @Prop({ required: true })
    channel?: string;

    // 메시지 타임스탬프(고유 ID)
    @Prop({ required: true })
    ts?: string;

    // Slack API가 반환한 raw 응답 전체를 저장 (JSON)
    @Prop({ type: Object })
    rawResponse: any;

    // DB에 기록된 시각 (자동 생성)
    @Prop({ default: Date.now })
    createdAt?: Date;
}

export type SlackMessageDocument = SlackMessage & Document;
export const SlackMessageSchema = SchemaFactory.createForClass(SlackMessage);
