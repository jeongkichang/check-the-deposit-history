import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class BananaSettlement {
    @Prop()
    period?: string;

    @Prop()
    userName?: string;

    @Prop()
    depositTime?: Date;

    @Prop()
    depositAmount?: number;

    @Prop()
    requiredAmount?: number;

    @Prop()
    isSettled?: boolean;
}

export type BananaSettlementDocument = BananaSettlement & Document;
export const BananaSettlementSchema = SchemaFactory.createForClass(BananaSettlement);
