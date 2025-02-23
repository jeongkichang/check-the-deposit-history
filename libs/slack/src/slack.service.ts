import { Injectable, Logger } from '@nestjs/common';
import { WebClient } from '@slack/web-api';

@Injectable()
export class SlackService {
    private readonly logger = new Logger(SlackService.name);
    private readonly slackClient: WebClient;

    constructor() {
        this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    }

    async postMessageToChannel(text: string): Promise<void> {
        try {
            const channelId = process.env.SLACK_CHANNEL_ID;
            if (!channelId) {
                throw new Error('SLACK_CHANNEL_ID is not defined in .env');
            }

            await this.slackClient.chat.postMessage({
                channel: channelId,
                text,
            });

            this.logger.log(`Slack message sent to channelId=${channelId}`);
        } catch (error) {
            this.logger.error('Failed to send Slack message', error);
            throw error;
        }
    }
}
