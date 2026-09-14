# Docker Hub режет анонимные запросы по IP, и на сервере с несколькими
# проектами лимит выбирается быстро: тогда сборка падает ещё на резолве тега.
# Образ вынесен в аргумент, чтобы в такой момент собраться через зеркало —
# например, mirror.gcr.io/library/node:22-alpine.
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci && npm --prefix backend ci

COPY . .
RUN npm run build && npm run build:backend

FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/dist /app/dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
