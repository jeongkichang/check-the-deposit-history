import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class TransactionAttachment {
    @Prop()
    messageId?: string;  // Gmail 메일 ID

    @Prop()
    subject?: string;

    @Prop()
    from?: string;

    @Prop()
    receivedDate?: Date;

    @Prop()
    filename?: string;

    @Prop()
    filePath?: string;

    @Prop()
    mimeType?: string;
}

export type TransactionAttachmentDocument = TransactionAttachment & Document;
export const TransactionAttachmentSchema = SchemaFactory.createForClass(TransactionAttachment);
