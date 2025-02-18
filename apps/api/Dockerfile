# ---------- 1) 빌드 스테이지 ----------
FROM node:22 as builder

WORKDIR /app

# 의존성 설치용 파일만 먼저 복사 (캐시 활용을 위해 package.json, yarn.lock만 복사)
COPY package.json yarn.lock ./
RUN yarn install

# 소스 및 설정 파일 복사
COPY nest-cli.json tsconfig.json ./
COPY libs ./libs
COPY apps ./apps

RUN yarn build:api

# ---------- 2) 런타임 스테이지 ----------
FROM node:22-alpine
WORKDIR /app

# timezone 설정 (Alpine)
RUN apk add --no-cache tzdata && \
    ln -snf /usr/share/zoneinfo/Asia/Seoul /etc/localtime && \
    echo "Asia/Seoul" > /etc/timezone

# 빌드 산출물(dist) 복사
COPY --from=builder /app/dist ./dist

# 프로덕션 구동에 필요한 package.json, yarn.lock 복사
COPY package.json yarn.lock ./
RUN yarn install --production

EXPOSE 3000

CMD ["node", "dist/apps/api/src/main"]