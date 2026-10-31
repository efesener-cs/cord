FROM node:24.22.1-alpine AS base
WORKDIR /app
RUN npm install --global pnpm@12.14.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

FROM base AS development
RUN pnpm install --frozen-lockfile --filter @cord/api...
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "@cord/api", "dev"]

FROM development AS build
RUN pnpm --filter @cord/api build

FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
RUN pnpm install --prod --frozen-lockfile --filter @cord/api...
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
