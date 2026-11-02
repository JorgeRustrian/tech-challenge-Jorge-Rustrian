import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { env } from './config/env';
import { documentoOpenApi } from './docs/openapi';
import { rutas } from './rutas';
import { manejadorErrores, rutaNoEncontrada } from './middlewares/manejadorErrores';

// Mensajes de validación en español.
z.config(z.locales.es());

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Documentación OpenAPI, generada de los mismos esquemas que validan las peticiones.
app.get('/api/docs/openapi.json', (_req, res) => {
  res.json(documentoOpenApi);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(documentoOpenApi, { customSiteTitle: 'ShopCart API' }));

app.use('/api', rutas);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);
