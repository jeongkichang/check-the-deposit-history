# ---------- 1) 빌드 스테이지 ----------
FROM node:18 as builder

WORKDIR /app

COPY package.json yarn.lock ./
COPY apps/next-frontend/package.json ./apps/next-frontend/

COPY apps/next-frontend ./apps/next-frontend

RUN yarn install
RUN yarn --cwd ./apps/next-frontend build

# ---------- 2) 런타임 스테이지 ----------
FROM node:18-alpine
WORKDIR /app

# 빌드 결과(.next), package.json 등 복사
COPY --from=builder /app/apps/next-frontend/.next ./apps/next-frontend/.next
COPY --from=builder /app/apps/next-frontend/package.json ./apps/next-frontend/
COPY --from=builder /app/yarn.lock ./

RUN yarn install --production --cwd ./apps/next-frontend

EXPOSE 3001

# 실행
CMD ["yarn", "--cwd", "apps/next-frontend", "start"]
