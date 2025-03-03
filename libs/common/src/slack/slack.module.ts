import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SlackService } from './slack.service';
import { 
  SlackMessage, 
  SlackMessageSchema 
} from '@libs/db/schemas/slack-message.schema';
import { 
  BananaUnitPrice, 
  BananaUnitPriceSchema 
} from '@libs/db/schemas/banana-unit-price.schema';
import { 
  SubscriptionUser, 
  SubscriptionUserSchema 
} from '@libs/db/schemas/subscription-user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SlackMessage.name, schema: SlackMessageSchema },
      { name: BananaUnitPrice.name, schema: BananaUnitPriceSchema },
      { name: SubscriptionUser.name, schema: SubscriptionUserSchema },
    ]),
  ],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
