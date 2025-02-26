import { SlackMessage, SlackMessageDocument } from '@libs/db/schemas/slack-message.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChatPostMessageResponse, WebClient } from '@slack/web-api';
import { Model } from 'mongoose';

@Injectable()
export class SlackService {
    private readonly logger = new Logger(SlackService.name);
    private readonly slackClient: WebClient;

    constructor(
        @InjectModel(SlackMessage.name)
        private readonly slackMessageModel: Model<SlackMessageDocument>,
    ) {
        this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    }

    async postMessageToChannel(
        text: string,
        channel: string,
    ): Promise<ChatPostMessageResponse> {
        try {
            const response = await this.slackClient.chat.postMessage({
              channel,
              text,
            });
      
            const slackMsg = new this.slackMessageModel({
              text,
              channel,
              ts: response.ts,          // Slack이 반환하는 메시지 타임스탬프
              rawResponse: response,    // 전체 응답 객체
            });
            await slackMsg.save();
      
            this.logger.log(
              `Slack 메시지 전송 & DB 로깅 성공: channel=${channel}, ts=${response.ts}`,
            );
            return response;
          } catch (error) {
            this.logger.error('Slack 메시지 전송 실패', error);
            throw error;
          }
    }

    async postThreadMessage(
        text: string,
        channel: string,
        parentTs: string,
    ): Promise<ChatPostMessageResponse> {
        try {
            const response = await this.slackClient.chat.postMessage({
                channel,
                text,
                thread_ts: parentTs,  // 스레드가 달릴 부모 메시지의 ts
            });

            // 전송 성공 시, DB 컬렉션에 로깅
            const slackMsg = new this.slackMessageModel({
                text,
                channel,
                ts: response.ts,
                rawResponse: response,
            });
            await slackMsg.save();

            this.logger.log(
                `Slack 스레드 메시지 전송 & DB 로깅 성공: channel=${channel}, parentTs=${parentTs}, ts=${response.ts}`,
            );
            return response;
        } catch (error) {
            this.logger.error('Slack 스레드 메시지 전송 실패', error);
            throw error;
        }
    }
}
