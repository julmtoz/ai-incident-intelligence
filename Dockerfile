FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY frontend frontend
RUN npm run prisma:generate -w backend && npm run build

FROM node:24-bookworm-slim AS production
ENV NODE_ENV=production \
    PORT=3001 \
    STATIC_DIR=/app/frontend/dist
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY backend/prisma backend/prisma
RUN npm ci --omit=dev \
    && npm run prisma:generate -w backend \
    && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist
USER node
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npm run prisma:migrate -w backend && npm run start -w backend"]
