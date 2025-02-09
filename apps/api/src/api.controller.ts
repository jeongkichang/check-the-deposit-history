import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { google } from 'googleapis';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    GmailToken,
    GmailTokenDocument,
} from '@libs/db/schemas/gmail-token.schema';

@Controller('api')
export class ApiController {
    private oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
    );

    constructor(
        @InjectModel(GmailToken.name)
        private readonly gmailTokenModel: Model<GmailTokenDocument>,
    ) {}

    @Get('gmail/auth')
    async authGmail(
        @Res() res: Response,
    ) {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/user.birthday.read',
        ];

        const url = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
        });

        return res.redirect(url);
    }

    @Get('gmail/callback')
    async gmailCallback(@Req() req: Request, @Res() res: Response) {
        const code = req.query.code as string;
        if (!code) {
            return res.status(400).json({ message: 'No code found' });
        }

        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            if (!tokens.access_token) {
                return res.status(400).json({ message: 'Failed to get access token.' });
            }

            this.oauth2Client.setCredentials(tokens);

            const people = google.people({ version: 'v1', auth: this.oauth2Client });
            const response = await people.people.get({
                resourceName: 'people/me',
                personFields: 'names,birthdays,emailAddresses',
            });

            const userData = response.data;
            const names = userData.names;
            const displayName = names?.[0]?.displayName;
            const birthdays = userData.birthdays;
            const birthday = birthdays?.[0]?.date;
            const emails = userData.emailAddresses;
            const email = emails?.[0]?.value;

            if(displayName !== process.env.GMAIL_USER_NAME){
                return res.status(403).json({
                    message: '허용되지 않은 사용자입니다. 이름이 일치하지 않습니다.',
                    userName: displayName,
                });
            }

            const tokenDoc = new this.gmailTokenModel({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                scope: tokens.scope,
                tokenType: tokens.token_type,
                expiryDate: tokens.expiry_date,
                name: displayName,
                birthday,
                email,
            });
            await tokenDoc.save();

            return res.json({
                message: '토큰 & 사용자 프로필 조회 성공',
                tokens,
                profile: {
                    name: displayName,
                    birthday: birthday,
                    email,
                },
            });
        } catch (error) {
            console.error(error);
            let errMsg = 'unknown error';
            if (error instanceof Error) {
                errMsg = error.message;
            }
            return res.status(500).json({
                message: '구글 인증 콜백 처리 중 에러 발생',
                error: errMsg,
            });
        }
    }
}
