import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class BananaUnitPrice {
    @Prop({ required: true })
    period?: string;

    @Prop({ required: true })
    unitPrice?: number;
}

export type BananaUnitPriceDocument = BananaUnitPrice & Document;
export const BananaUnitPriceSchema = SchemaFactory.createForClass(BananaUnitPrice);
