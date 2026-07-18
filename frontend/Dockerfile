FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install && ROLLUP_VERSION=$(node -p "require('./node_modules/rollup/package.json').version") && npm install --no-save "@rollup/rollup-linux-x64-gnu@$ROLLUP_VERSION"
COPY packages/shared-types packages/shared-types
COPY frontend frontend

FROM dependencies AS test
CMD ["npm", "run", "test", "-w", "frontend"]

FROM dependencies AS build
RUN npm run build -w frontend

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
