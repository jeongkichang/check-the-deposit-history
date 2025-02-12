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

        const three: Array<{ name: string; isSettled: boolean }> = [];
        const four: Array<{ name: string; isSettled: boolean }> = [];

        for (const user of allUsers) {
            const userName = user.name;
            const quantity = user.quantity;
            if (!userName || !quantity) continue;

            const settlementDoc = await this.settlementModel.findOne({
                userName,
                period,
            }).exec();
            const isSettled = settlementDoc?.isSettled === true;

            if (quantity === 3) {
                three.push({ name: userName, isSettled });
            } else if (quantity === 4) {
                four.push({ name: userName, isSettled });
            }
        }

        return {
            period,
            three,
            four,
        };
    }
}
