FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install && ROLLUP_VERSION=$(node -p "require('./node_modules/rollup/package.json').version") && npm install --no-save "@rollup/rollup-linux-x64-gnu@$ROLLUP_VERSION"
COPY packages/shared-types packages/shared-types
COPY backend backend

FROM dependencies AS test
CMD ["npm", "run", "test", "-w", "backend"]

FROM dependencies AS build
RUN npm run build -w backend && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/package.json
RUN mkdir -p /app/data
EXPOSE 3001
CMD ["node", "backend/dist/server.js"]
