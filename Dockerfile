# syntax=docker/dockerfile:1.7

# Install and compile on the GitHub runner architecture, not under ARM64 QEMU.
# SALTA currently ships JavaScript dependencies only, so the resulting build
# output can be copied into both target runtime images.
FROM --platform=$BUILDPLATFORM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN ! grep -q "packages.applied-caas-gateway\|internal.api.openai.org" package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM deps AS production-deps
RUN npm prune --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# This final stage is created separately for every requested target platform.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S salta && adduser -S salta -G salta
COPY package.json package-lock.json ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY public ./public
RUN chown -R salta:salta /app
USER salta
EXPOSE 8099 51826
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8099/internal/health',{headers:{'x-salta-health-token':process.env.SALTA_HEALTH_TOKEN}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
