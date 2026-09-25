FROM node:22-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /repo

ARG GITHUB_TOKEN
COPY .npmrc tsconfig.json biome.jsonc ./
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/research-agent/package.json apps/research-agent/package.json
COPY packages/core/turboplan-auth/package.json packages/core/turboplan-auth/package.json
COPY packages/core/turboplan-db/package.json packages/core/turboplan-db/package.json
COPY packages/core/turboplan-env/package.json packages/core/turboplan-env/package.json
COPY packages/core/turboplan-utils/package.json packages/core/turboplan-utils/package.json
COPY packages/modules/turboplan-document-extraction/package.json packages/modules/turboplan-document-extraction/package.json

RUN pnpm install --frozen-lockfile --filter @wildfires-org/research-agent...

COPY apps/research-agent apps/research-agent
COPY packages/core/turboplan-auth packages/core/turboplan-auth
COPY packages/core/turboplan-db packages/core/turboplan-db
COPY packages/core/turboplan-env packages/core/turboplan-env
COPY packages/core/turboplan-utils packages/core/turboplan-utils
COPY packages/modules/turboplan-document-extraction packages/modules/turboplan-document-extraction

RUN pnpm --filter @wildfires-org/research-agent... build
RUN pnpm deploy --legacy --filter @wildfires-org/research-agent --prod /prod/research-agent

FROM node:22-slim AS runtime

ENV NODE_ENV="production"

WORKDIR /app

COPY --from=build /prod/research-agent/ ./

EXPOSE 8080
CMD ["node", "dist/app/server.js"]
