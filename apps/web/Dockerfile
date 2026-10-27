# Imagen de producción de la web. Se construye desde la raíz del monorepo:
#   docker build -f apps/web/Dockerfile .

# 1) Compilar React con Vite (necesita las devDependencies de la raíz: vite, tailwind…).
FROM node:22-alpine AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @ecofiltro/web --include-workspace-root
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @ecofiltro/web

# 2) nginx sin privilegios: sirve los archivos estáticos y reenvía /api al contenedor de la API.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
