import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module.js';

const currentDir = dirname(fileURLToPath(import.meta.url));

/**
 * Resuelve la carpeta con el build del frontend (Vite).
 * En la imagen Docker el frontend se copia a `dist/public` (junto al bundle
 * del backend). En local, se cae al `front/dist` del monorepo si existe.
 */
function resolveFrontendDir(): string | null {
  const candidates = [
    process.env.FRONTEND_DIST,
    join(currentDir, 'public'),
    resolve(currentDir, '..', '..', 'front', 'dist'),
  ].filter((c): c is string => Boolean(c));

  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir;
  }
  return null;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Toda la API vive bajo /api para no colisionar con los estáticos del SPA.
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS para desarrollo (Vite en :5173). En producción el frontend se sirve
  // desde el mismo origen, por lo que CORS es irrelevante.
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  // Servir el frontend compilado (SPA) desde el mismo servidor Nest.
  const frontendDir = resolveFrontendDir();
  if (frontendDir) {
    const httpAdapter = app.getHttpAdapter().getInstance();

    // Assets con cache; index.html sin cache para recoger despliegues nuevos.
    httpAdapter.use(
      express.static(frontendDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );

    // Fallback SPA: cualquier ruta que no sea de la API ni un asset conocido
    // devuelve index.html para que React Router maneje el enrutado en cliente.
    httpAdapter.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(join(frontendDir, 'index.html'));
    });
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
