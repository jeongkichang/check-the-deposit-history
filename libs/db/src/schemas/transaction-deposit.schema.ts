import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class TransactionDeposit {
    @Prop()
    depositTime?: Date;

    @Prop()
    depositorName?: string;

    @Prop()
    amount?: number;
}

export type TransactionDepositDocument = TransactionDeposit & Document;
export const TransactionDepositSchema = SchemaFactory.createForClass(TransactionDeposit);
