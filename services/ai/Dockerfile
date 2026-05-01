FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ai/package.json packages/ai/
COPY services/ai/package.json services/ai/
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=deps /app/services/ai/node_modules ./services/ai/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ai ./packages/ai
COPY services/ai ./services/ai
RUN pnpm --filter @notion/ai-service build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/dist/services/ai ./dist/services/ai
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=deps /app/services/ai/node_modules ./services/ai/node_modules

EXPOSE 3001
CMD ["node", "dist/services/ai/src/server.js"]
