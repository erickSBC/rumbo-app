# ---- Etapa 1: build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos e instalar TODAS las dependencias (incluye dev para compilar TS)
COPY package*.json ./
RUN npm ci

# Copiar el código y compilar
COPY . .
RUN npm run build

# ---- Etapa 2: runtime ----
FROM node:20-alpine

WORKDIR /app

# Solo dependencias de producción (imagen final más liviana)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar la carpeta compilada desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Documenta el puerto (no lo abre por sí solo)
EXPOSE 8080

# Arrancar el servidor
CMD ["node", "dist/index.js"]