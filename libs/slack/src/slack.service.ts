import { SlackMessage, SlackMessageDocument } from '@libs/db/schemas/slack-message.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChatPostMessageResponse, WebClient } from '@slack/web-api';
import { Model } from 'mongoose';
import { BananaUnitPrice, BananaUnitPriceDocument } from "@libs/db/schemas/banana-unit-price.schema";
import { SubscriptionUser, SubscriptionUserDocument } from "@libs/db/schemas/subscription-user.schema";

interface BankAccountInfo {
    accountNumber: string;
    bankName: string;
    accountHolder: string;
}

interface BananaSettlement {
    emoji?: string;
    accountInfo: BankAccountInfo;
    smallPurchasers: string[];
    smallPrice: number;
    largePurchasers: string[];
    largePrice: number;
}

@Injectable()
export class SlackService {
    private readonly logger = new Logger(SlackService.name);
    private readonly slackClient: WebClient;

    constructor(
        @InjectModel(SlackMessage.name)
        private readonly slackMessageModel: Model<SlackMessageDocument>,

        @InjectModel(BananaUnitPrice.name)
        private readonly bananaUnitPriceModel: Model<BananaUnitPriceDocument>,

        @InjectModel(SubscriptionUser.name)
        private readonly subscriptionUserModel: Model<SubscriptionUserDocument>,
    ) {
        this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    }

    private readonly defaultAccountInfo: BankAccountInfo = {
        accountNumber: '130012-56-051196',
        bankName: '농협',
        accountHolder: '정기창',
    };

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
              ts: response.ts,
              rawResponse: response,
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
                thread_ts: parentTs,
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

    async sendBananaSettlementMessage(
        channel: string,
        settlement: BananaSettlement,
    ): Promise<ChatPostMessageResponse> {
        try {
            const formatPrice = (price: number): string => {
                return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            };

            const emoji = ':mkk08:';
            const { accountNumber, bankName, accountHolder } = settlement.accountInfo;
            const smallPrice = formatPrice(settlement.smallPrice);
            const largePrice = formatPrice(settlement.largePrice);

            const smallPurchasersText = settlement.smallPurchasers.join('\n');
            const largePurchasersText = settlement.largePurchasers.join('\n');

            const messageText = `바나나 자리에 나눠드렸습니다. ${emoji}\n` +
                `${accountNumber}\n` +
                `${bankName} ${accountHolder}\n` +
                `3개 : ${smallPrice}\n` +
                `${smallPurchasersText}\n` +
                `4개 : ${largePrice}\n` +
                `${largePurchasersText}`;

            return await this.postMessageToChannel(messageText, channel);
        } catch (error) {
            this.logger.error('바나나 정산 메시지 전송 실패', error);
            throw error;
        }
    }
}
