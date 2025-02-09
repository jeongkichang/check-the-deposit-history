import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class GmailToken {
    @Prop()
    accessToken?: string;

    @Prop()
    refreshToken?: string;

    @Prop()
    scope?: string;

    @Prop()
    tokenType?: string;

    @Prop()
    expiryDate?: number;
}

export type GmailTokenDocument = GmailToken & Document;
export const GmailTokenSchema = SchemaFactory.createForClass(GmailToken);
