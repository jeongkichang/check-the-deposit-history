import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class GmailSyncState {
    @Prop({ required: true, default: 'default' })
    key?: string;

    @Prop()
    lastSyncedDate?: Date;
}

export type GmailSyncStateDocument = GmailSyncState & Document;
export const GmailSyncStateSchema = SchemaFactory.createForClass(GmailSyncState);
