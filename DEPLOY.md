# Despliegue en EasyPanel

Este proyecto se empaqueta en **una sola imagen Docker** que sirve tanto la API
(NestJS) como el frontend (Vite/React):

- La API queda bajo el prefijo **`/api`** (por ejemplo `GET /api/productos`).
- El frontend (SPA) se sirve en la raíz **`/`**, con fallback a `index.html`
  para el enrutado del lado del cliente (React Router).
- El frontend llama a la API con rutas relativas (`VITE_API_URL=/api`), así que
  funciona en cualquier dominio sin reconfigurar.

## 1. Crear la app en EasyPanel

1. Crea un servicio de tipo **App**.
2. Fuente: el repositorio Git `https://github.com/ZurielRamos/cotizador.git`.
3. Método de build: **Dockerfile** (el `Dockerfile` está en la raíz del repo).
4. Puerto interno: **3000**.

## 2. Variables de entorno

Configura estas variables en el panel del servicio (no se leen de `.env` dentro
de la imagen; EasyPanel las inyecta en el contenedor):

| Variable              | Requerida | Ejemplo / valor                         | Notas |
|-----------------------|-----------|-----------------------------------------|-------|
| `NODE_ENV`            | no        | `production`                            | Ya viene en la imagen. |
| `PORT`                | no        | `3000`                                  | Debe coincidir con el puerto expuesto. |
| `DB_HOST`             | si        | `postgres`                              | Host del PostgreSQL. |
| `DB_PORT`             | si        | `5432`                                  | |
| `DB_USERNAME`         | si        | `postgres`                              | |
| `DB_PASSWORD`         | si        | `********`                              | |
| `DB_NAME`             | si        | `cotizador`                             | |
| `DB_SYNCHRONIZE`      | no        | `false`                                 | En produccion usa migraciones, no `true`. |
| `DB_LOGGING`          | no        | `false`                                 | |
| `PUBLIC_API_URL`      | si*       | `https://cotizador.tudominio.com`       | URL publica de esta app. Se le anade `/api/evolution/webhook` automaticamente. *Solo necesario si usas Evolution/webhooks. |
| `APP_ENCRYPTION_KEY`  | si        | hex de 32 bytes                         | Genera con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `FRONTEND_ORIGIN`     | no        | (no aplica en prod)                     | Solo para CORS en desarrollo; en prod el front es del mismo origen. |

> **PUBLIC_API_URL**: pon solo el dominio base (con o sin `/api`). El backend
> construye la URL del webhook como `<PUBLIC_API_URL>/api/evolution/webhook`.

## 3. Base de datos

Provisiona un servicio **PostgreSQL** en EasyPanel y apunta las variables `DB_*`
a el. La primera vez, si no usas migraciones, puedes arrancar con
`DB_SYNCHRONIZE=true` para crear el esquema y luego ponerlo en `false`.

## 4. Build y verificacion local (opcional)

```bash
# Construir la imagen
docker build -t cotizador .

# Ejecutar (ajusta las variables segun tu entorno)
docker run --rm -p 3000:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=cotizador \
  -e APP_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
  cotizador
```

Luego:
- Frontend: `http://localhost:3000/`
- API: `http://localhost:3000/api/productos`

## Notas de arquitectura

- El backend detecta el frontend compilado en `dist/public` (donde el Dockerfile
  lo copia). En desarrollo local sin Docker, si existe `front/dist` tambien lo
  sirve. Se puede forzar la ruta con la variable `FRONTEND_DIST`.
- El servidor escucha en `0.0.0.0` para ser accesible dentro del contenedor.
