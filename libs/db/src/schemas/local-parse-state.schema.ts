import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class LocalParseState {
    @Prop({ required: true, default: 'default' })
    key?: string;

    @Prop()
    lastFileName?: string;
}

export type LocalParseStateDocument = LocalParseState & Document;
export const LocalParseStateSchema = SchemaFactory.createForClass(LocalParseState);
