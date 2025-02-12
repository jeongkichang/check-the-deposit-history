import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    SubscriptionUser,
    SubscriptionUserDocument,
} from '@libs/db/schemas/subscription-user.schema';
import {
    BananaSettlement,
    BananaSettlementDocument,
} from '@libs/db/schemas/banana-settlement.schema';

@Injectable()
export class ApiService {
    constructor(
        @InjectModel(SubscriptionUser.name)
        private readonly userModel: Model<SubscriptionUserDocument>,
        @InjectModel(BananaSettlement.name)
        private readonly settlementModel: Model<BananaSettlementDocument>,
    ) {}

    async getSettlementStatusForPeriod(period: string) {
        const allUsers = await this.userModel.find().exec();
        const settled: string[] = [];
        const notSettled: string[] = [];

        for (const user of allUsers) {
            const userName = user.name;
            if (!userName) continue;

            const settlementDoc = await this.settlementModel.findOne({
                userName,
                period,
            }).exec();

            if (settlementDoc && settlementDoc.isSettled) {
                settled.push(userName);
            } else {
                notSettled.push(userName);
            }
        }

        return {
            period,
            settled,
            notSettled,
        };
    }
}
