FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --ignore-scripts
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY scripts/seed.js scripts/seed.js
COPY scripts/ingest-market.js scripts/ingest-market.js
USER node
EXPOSE 3001
CMD ["node", "apps/server/src/index.js"]
