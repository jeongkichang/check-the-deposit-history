import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
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
    
    @Prop()
    name?: string;
    
    @Prop()
    email?: string;
}

export type GmailTokenDocument = GmailToken & Document & {
    createdAt: Date;
    updatedAt: Date;
};
export const GmailTokenSchema = SchemaFactory.createForClass(GmailToken);
