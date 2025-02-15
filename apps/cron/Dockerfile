# ---------- 1) 빌드 스테이지 ----------
FROM node:18 as builder
WORKDIR /app

COPY package.json yarn.lock ./
COPY nest-cli.json tsconfig.json .env ./
COPY libs ./libs
COPY apps ./apps

RUN yarn install

# cron 앱만 빌드
RUN yarn build:cron

# ---------- 2) 런타임 스테이지 ----------
FROM node:18-alpine
WORKDIR /app

COPY --from=builder /app/dist/apps/cron ./dist/apps/cron
COPY package.json yarn.lock ./
RUN yarn install --production

VOLUME ["/app/data"]

# 실행
CMD ["node", "dist/apps/cron/main"]
