# Imagen de producción de la API. Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile .

# 1) Dependencias de producción (argon2 trae binarios precompilados; las herramientas de
#    compilación quedan por si alguna plataforma no los tiene, y no pasan a la imagen final).
FROM node:22-alpine AS dependencias
RUN apk add --no-cache python3 make g++
WORKDIR /app
# npm ci necesita el package.json de todos los workspaces para respetar el lockfile.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace @ecofiltro/api --include-workspace-root=false

# 2) Imagen final: solo Node, dependencias y código. Corre como usuario sin privilegios.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node packages/shared packages/shared
COPY --chown=node:node apps/api/package.json apps/api/
COPY --chown=node:node apps/api/src apps/api/src
COPY --chown=node:node apps/api/migrations apps/api/migrations
COPY --chown=node:node apps/api/scripts apps/api/scripts
USER node
WORKDIR /app/apps/api
EXPOSE 3000
# Docker marca el contenedor como "unhealthy" si la API o la base no responden.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/salud >/dev/null || exit 1
CMD ["node", "src/server.js"]
