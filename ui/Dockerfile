# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copia configurações de dependências do monorepo
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY api/package*.json ./api/
COPY worker/package*.json ./worker/
COPY ui/package*.json ./ui/

# Instala dependências
RUN npm ci

# Copia código fonte
COPY packages/shared ./packages/shared
COPY ui ./ui

# Compila pacotes compartilhados e a UI
RUN npm run build --workspace=@taxi-rio/shared
RUN npm run build --workspace=ui

# Production Stage
FROM nginx:1.27-alpine

# Copia configuração personalizada do Nginx
COPY ui/nginx.conf /etc/nginx/conf.d/default.conf

# Copia artefatos estáticos compilados
COPY --from=builder /app/ui/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
