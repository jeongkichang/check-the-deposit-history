import { SlackMessage, SlackMessageDocument } from '@libs/db/schemas/slack-message.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChatPostMessageArguments, ChatPostMessageResponse, WebClient } from '@slack/web-api';
import { Model } from 'mongoose';
import { BananaUnitPrice, BananaUnitPriceDocument } from "@libs/db/schemas/banana-unit-price.schema";
import { SubscriptionUser, SubscriptionUserDocument } from "@libs/db/schemas/subscription-user.schema";
import { BankAccountInfo } from './interfaces/bank-account.interface';
import { getPeriodFromDate } from '@libs/common/utils';

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
    ): Promise<ChatPostMessageResponse> {
        try {
            // 1. 가장 최신 바나나 가격 정보 가져오기
            const latestUnitPrice = await this.bananaUnitPriceModel
                .findOne()
                .sort({ _id: -1 })
                .exec();

            if (!latestUnitPrice) {
                throw new Error('바나나 단가 정보를 찾을 수 없습니다.');
            }

            // 디버깅을 위해 가져온 단가 정보 로깅
            this.logger.debug('최신 바나나 단가 정보:', latestUnitPrice);

            // 단가 값이 있는지 확인하고 적절한 필드명 사용
            if (!latestUnitPrice.unitPrice) {
                throw new Error('바나나 단가 값을 찾을 수 없습니다.');
            }

            // 실제 필드명에 맞게 가격 변수 설정
            const unitPrice = latestUnitPrice.unitPrice;
            
            // 현재 날짜로부터 정산 기간 계산
            const currentDate = new Date();
            const period = getPeriodFromDate(currentDate);
            
            // 2. 모든 구독 사용자 가져오기
            const allUsers = await this.subscriptionUserModel.find().exec();
            
            // 3. 구독자를 3개/4개 구독으로 분류
            const smallPurchasers: string[] = [];
            const largePurchasers: string[] = [];
            
            allUsers.forEach(user => {
                if (!user.name) return;
                
                if (user.quantity === 3) {
                    smallPurchasers.push(user.name);
                } else if (user.quantity === 4) {
                    largePurchasers.push(user.name);
                }
            });
            
            // 4. 가격 계산 (단가에 수량을 곱함)
            const smallPrice = unitPrice * 3;
            const largePrice = unitPrice * 4;
            
            // 가격 포맷팅 함수
            const formatPrice = (price: number): string => {
                return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            };

            // 계좌 정보 가져오기 (기본 계좌 사용)
            const { accountNumber, bankName, accountHolder } = this.defaultAccountInfo;
            
            // 이름에서 성을 제거하고 들여쓰기된 목록 생성
            const removeLastName = (name: string): string => {
                // 한글 이름의 첫 글자(성)를 제거하고 나머지 이름만 반환
                return name.substring(1);
            };
            
            // 이미지와 동일한 형식 유지 (공백 2칸으로 들여쓰기)
            const smallPurchasersText = smallPurchasers
                .map(name => `  ○ ${removeLastName(name)}님`)
                .join('\n');
            
            const largePurchasersText = largePurchasers
                .map(name => `  ○ ${removeLastName(name)}님`)
                .join('\n');

            // 슬랙 메시지 파라미터 - 기간 정보 추가
            const periodText = period ? `[${period}] ` : '';
            const params = {
                channel,
                text: `${periodText}\n안녕하세요. :)\n바나나 자리에 나눠드렸습니다. :mkk08:\n\n${accountNumber}\n${bankName} ${accountHolder}\n\n• 3개 : ${formatPrice(smallPrice)}\n${smallPurchasersText}\n\n• 4개 : ${formatPrice(largePrice)}\n${largePurchasersText}`,
                mrkdwn: true,
                parse: 'full',
                attachments: []
            } as ChatPostMessageArguments;

            // WebClient 직접 호출하여 메시지 전송
            const response = await this.slackClient.chat.postMessage(params);

            // DB에 메시지 로깅 - 기간 정보 추가
            const slackMsg = new this.slackMessageModel({
                text: params.text,
                channel,
                ts: response.ts,
                period: period, // 기간 정보 저장
                rawResponse: response,
            });
            await slackMsg.save();

            this.logger.log(
                `바나나 정산 메시지 전송 & DB 로깅 성공: channel=${channel}, period=${period}, ts=${response.ts}`,
            );
            
            return response;
        } catch (error) {
            this.logger.error('바나나 정산 메시지 전송 실패', error);
            throw error;
        }
    }

    // 특정 기간의 정산 메시지 찾기
    async findSettlementMessageByPeriod(period: string): Promise<SlackMessageDocument | null> {
        try {
            // 정규식 특수 문자를 이스케이프 처리
            const escapedPeriod = period.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const periodPattern = `\\[${escapedPeriod}\\]`;
            
            this.logger.debug(`정산 메시지 검색 패턴: ${periodPattern}`);
            
            return await this.slackMessageModel.findOne({ 
                text: { $regex: periodPattern, $options: 'i' } 
            }).exec();
        } catch (error) {
            this.logger.error(`기간(${period})으로 정산 메시지 검색 실패`, error);
            throw error;
        }
    }

    // 입금 확인 메시지 전송
    async sendPaymentConfirmation(
        userName: string,
        parentMessageTs: string,
        channel: string
    ): Promise<ChatPostMessageResponse> {
        try {
            // 이름에서 성을 제거하는 함수
            const removeLastName = (name: string): string => {
                // 한글 이름의 첫 글자(성)를 제거하고 나머지 이름만 반환
                return name.substring(1);
            };
            
            // 성을 제거한 이름으로 메시지 생성
            const nameWithoutLastName = removeLastName(userName);
            const confirmationText = `${nameWithoutLastName}님이 입금 완료하셨습니다. ✅`;
            
            return await this.postThreadMessage(
                confirmationText,
                channel,
                parentMessageTs
            );
        } catch (error) {
            this.logger.error(`입금 확인 메시지 전송 실패: ${userName}`, error);
            throw error;
        }
    }
}
