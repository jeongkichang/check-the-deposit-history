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
FROM node:22
WORKDIR /app

# Puppeteer가 필요한 의존 라이브러리 + Chromium 설치
# (Debian/Ubuntu 계열에서는 apt-get 사용)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    xdg-utils \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Timezone KST 설정
RUN ln -snf /usr/share/zoneinfo/Asia/Seoul /etc/localtime && \
    echo "Asia/Seoul" > /etc/timezone


ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=builder /app/dist ./dist
COPY package.json yarn.lock ./
RUN yarn install --production

VOLUME ["/app/data"]

# 실행
CMD ["node", "dist/apps/cron/src/main"]
