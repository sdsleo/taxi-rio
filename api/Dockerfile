FROM node:22-alpine AS builder

WORKDIR /app

# Copiar arquivos de configuração de dependências de todos os workspaces do monorepo
COPY package*.json tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY api/package*.json ./api/
COPY worker/package*.json ./worker/
COPY ui/package*.json ./ui/

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY packages/shared/ ./packages/shared/
COPY api/ ./api/

# Build do shared e da API
RUN npm run build --workspace=@taxi-rio/shared
RUN npm run build --workspace=api

# ------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Usuário não-root para segurança
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --chown=node:node --from=builder /app/api/dist ./api/dist
COPY --chown=node:node --from=builder /app/api/package*.json ./api/

EXPOSE 3000

CMD ["node", "api/dist/main.js"]
