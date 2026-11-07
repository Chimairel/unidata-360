FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY backend ./backend
COPY shared ./shared
RUN npm run build --workspace backend && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3006 \
    EDM_AUTH_MODE=accounts EDM_SECURE_COOKIES=true
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/backend ./backend
COPY --from=build /app/frontend/package.json ./frontend/package.json
COPY --from=build /app/shared ./shared
COPY scripts/start-hosted.mjs scripts/create-account.ts ./scripts/
USER node
EXPOSE 3006
CMD ["node", "scripts/start-hosted.mjs"]
