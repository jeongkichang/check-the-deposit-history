import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class SubscriptionUser {
  @Prop({ required: true })
  name?: string;

  @Prop({ required: true })
  quantity?: number;
}

export type SubscriptionUserDocument = SubscriptionUser & Document;
export const SubscriptionUserSchema = SchemaFactory.createForClass(SubscriptionUser);
