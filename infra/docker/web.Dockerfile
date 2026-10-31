FROM node:24.22.1-alpine AS development
WORKDIR /app
RUN npm install --global pnpm@12.14.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter @cord/web...
COPY tsconfig.base.json tsconfig.json ./
COPY apps/web apps/web
COPY packages/client packages/client
COPY packages/ui packages/ui
EXPOSE 5173
CMD ["pnpm", "dev"]

FROM development AS build
RUN pnpm build

FROM caddy:2.11.7-alpine AS runtime
COPY infra/proxy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 80
