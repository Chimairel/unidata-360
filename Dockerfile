FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY next.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3005 \
    EDM_AUTH_MODE=accounts EDM_SECURE_COOKIES=true
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/src/lib ./src/lib
COPY scripts/start-hosted.mjs scripts/create-account.ts ./scripts/
USER node
EXPOSE 3005
CMD ["node", "scripts/start-hosted.mjs"]
