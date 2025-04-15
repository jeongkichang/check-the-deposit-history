import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiService } from './api.service';
import { MongooseModule } from '@nestjs/mongoose';
import { DbModule } from '@libs/db';
import { ApiController } from "./api.controller";
import { SlackModule } from '@libs/common';
import { GmailToken, GmailTokenSchema } from '@libs/db/schemas/gmail-token.schema';
import { TransactionAttachment, TransactionAttachmentSchema } from '@libs/db/schemas/transaction-attachment.schema';


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/dbname'),
        MongooseModule.forFeature([
            {
                name: GmailToken.name,
                schema: GmailTokenSchema,
                collection: 'gmail_token',
            },
            {
                name: TransactionAttachment.name,
                schema: TransactionAttachmentSchema,
                collection: 'transaction_attachment',
            },
        ]),
        DbModule,
        SlackModule,
    ],
    controllers: [ApiController],
    providers: [ApiService],
})
export class ApiModule {}

// 크론이 5분마다 수집을 시작한다.
// 처음에 수집한 기간을 체크한다. 이를테면 2025.04.01 13:01 이라고 하자.
// 계속 덮어쓰기 구조로 가야할 거 같다. 쌓이면 답이 없을 거 같은데,, 로그로 처리하는 게 맞으려나
// 빈틈없이 수집이 되어야 한다. 멱등성?
// 1회차, 2회차, 3회차, 4회차, 5회차 ..
// 13:06
// 13:11
// 13:16
// 13:21
// 13:26 -> 5회차
// 서버의 문제로 인해서 4회차가 진행이 되지 않았었을 수도 있다.
// 그럼 5회차인지를 확인해서, 4회차도 수집하고 5회차도 수집이 되어야 한다.
// 전 회차가 동작을 했는지 안했는지를 확인해볼 수 있는 방법은..? (그래서 레디스를 썼나보구나), 로빈후드 어쩌구 방식 있지 않나

// 1. 13:26에 데이터를 수집하기 전에, 이전 회차가 수집이 됐는지 확인한다.
// 2. 이전 회차는 13:21에 수집이 되어야 했다.
// 3. 이전 회차인 13:21에 수집이 됐는지 확인이 되면, 13:26의 데이터를 수집한다.
// 4. 이전 회차인 13:21에 수집이 되지 않았다면, 더 이전 회차인 13:16에 데이터가 수집이 됐는지 확인한다.
// 5. 더 이전 회차인 13:16에 데이터가 수집이 됐다면, 이전 회차인 13:21의 데이터를 수집한다.
// 6. 이전 회차인 13:21에 데이터를 수집하면, 현재 회차인 13:26의 데이터를 수집한다.
// 7. 현재 회차를 수집하는 시점이 13:31이면 다음 회차도 1-6을 반복할 수 있다.
// 8. 다음 회차가 이전 회차로 판단할 현재 회차 수집이 됐는지를 확인하게 된다.
// 9. 현재 회차는 아직 수집 중인 걸 다음 회차가 알아야 한다.
// 10. 그러면 다음 회차가 현재 회차가 수집 중인 걸 알았으니, 다음 회차는 다음 회차만 데이터를 수집한다.
// 11. 각각의 회차는 수집 중, 수집 완료 상태를 가지고 있다.
// 12. 중간에 실패하게 되면 특정 회차의 상태는 수집 중 상태에서 멈출 것이다.
// 13. access_token이 유효하지 않아서 수집이 안되는 경우도 있다.
// 14. 수집한 데이터는 매칭 시켜야하는 데이터가 있는지 찾아야 한다.
// 15. 매칭 시켜야 하는 데이터는 수집한 데이터의 시점보다 항상 뒤에 있다.\
// 16. 수동 매칭에 대한 개념도 도입해야한다.
// 17. 통계도 낼 수 있는데,, 그건 완전 나중에.

// MSA 작업을 하기 위해서는 어떤 기술들을 알아야 할까...

// 수집을 중지하고 싶은 마음이 있을지?

// 초 단위는 어떻게 해야하지?
// 만든 작업물을 kotilin으로 변경하면서 이런 거 할 수 있다는 느낌으로 가면 좋을텐데

// 여러 쓰레드로 처리해야한다는 얘기가 된다.

// 1. 4회차이다, 13:26에 데이터를 수집해야한다.
// 2. 3회차 데이터가 수집 됐는지 확인한다.
// 3. 3회차 데이터가 수집되지 않았다면 2회차 데이터는 수집 됐는지 확인한다.
// 4. ... 계속 계속 이전 회차 수집이 됐는지를 체크한다.
// 5. 이전 이전으로 되돌아가다가 수집된 이력이 있으면 그 다음 회차 수집할 준비한다.
// 6. 그 다음 회차 수집을 시작하게 되면 해당 회차는 수집 중 상태로 바꿔놓아야 한다.
// 7. 한편, 이전 회차를 처리할 동안에 6회차 수집이 시작되는 때까지 이전 작업이 끝나지 않을 수 있다.


// 수집에 시간이 꽤 오래 걸릴 수도 있다는 점.. ㅠ

// 하루에 288개의 데이터가 쌓이는 셈..
