# syntax=docker/dockerfile:1

# =============================================================================
# Cotizador Automatico 3000 - imagen unica que sirve API (NestJS) + frontend
# (Vite/React). El backend expone la API bajo /api y sirve el SPA en /.
# Pensada para desplegarse en EasyPanel (build por Dockerfile).
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: build del frontend (Vite -> front/dist)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS frontend-build
WORKDIR /app/front

# Instalar dependencias primero para aprovechar la cache de capas.
COPY front/package.json front/package-lock.json ./
RUN npm ci

# Codigo del frontend. front/.env.production fija VITE_API_URL=/api.
COPY front/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: build del backend (NestJS -> api/dist)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS backend-build
WORKDIR /app/api

# .npmrc trae legacy-peer-deps=true (necesario por los peers de Nest 12).
COPY api/package.json api/package-lock.json api/.npmrc ./
RUN npm ci

COPY api/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: dependencias de produccion del backend (sin devDependencies)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS backend-deps
WORKDIR /app/api
COPY api/package.json api/package-lock.json api/.npmrc ./
RUN npm ci --omit=dev

# -----------------------------------------------------------------------------
# Stage 4: runtime
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Dependencias de produccion + bundle compilado del backend.
COPY --from=backend-deps /app/api/node_modules ./node_modules
COPY --from=backend-build /app/api/dist ./dist
COPY api/package.json ./package.json

# El frontend compilado se coloca en dist/public; main.ts lo sirve desde ahi.
COPY --from=frontend-build /app/front/dist ./dist/public

# Ejecutar como usuario no root (imagen base ya trae el usuario "node").
USER node

EXPOSE 3000
ENV PORT=3000

CMD ["node", "dist/main"]
