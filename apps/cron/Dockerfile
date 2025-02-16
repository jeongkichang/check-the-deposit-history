# ---------- 1) 빌드 스테이지 ----------
FROM node:22 as builder
WORKDIR /app

COPY package.json yarn.lock ./
COPY nest-cli.json tsconfig.json ./
COPY libs ./libs
COPY apps ./apps

RUN yarn install

# cron 앱만 빌드
RUN yarn build:cron

# ---------- 2) 런타임 스테이지 ----------
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package.json yarn.lock .env ./
RUN yarn install --production

VOLUME ["/app/data"]

# 실행
CMD ["node", "dist/apps/cron/src/main"]
