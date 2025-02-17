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

# Puppeteer가 필요로 하는 Chromium 및 라이브러리 설치
RUN apk update && apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

COPY --from=builder /app/dist ./dist
COPY package.json yarn.lock ./
RUN yarn install --production

VOLUME ["/app/data"]

# 실행
CMD ["node", "dist/apps/cron/src/main"]
