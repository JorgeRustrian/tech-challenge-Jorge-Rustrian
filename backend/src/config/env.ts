import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().min(1),

  DB_SERVER: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_ENCRYPT: z.stringbool().default(false),
  DB_TRUST_SERVER_CERT: z.stringbool().default(true),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRA_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_DIAS: z.coerce.number().int().positive().default(7),
  BCRYPT_COSTO: z.coerce.number().int().min(10).max(14).default(10),

  RESERVA_MINUTOS: z.coerce.number().int().min(1).max(60).default(15),
  CARRITO_ABANDONADO_MINUTOS: z.coerce.number().int().positive().default(60),
  COSTO_ENVIO: z.coerce.number().nonnegative().default(35),
  ENVIO_GRATIS_DESDE: z.coerce.number().nonnegative().default(500),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  console.error('Variables de entorno invalidas:');
  for (const issue of resultado.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = resultado.data;
