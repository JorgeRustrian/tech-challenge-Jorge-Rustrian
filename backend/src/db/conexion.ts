import sql from 'mssql';
import { env } from '../config/env';

const config: sql.config = {
  server: env.DB_SERVER,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: {
    encrypt: env.DB_ENCRYPT,
    trustServerCertificate: env.DB_TRUST_SERVER_CERT,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Se guarda la promesa para que dos llamadas simultáneas no abran dos pools.
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function obtenerPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err: unknown) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

export async function cerrarPool(): Promise<void> {
  if (poolPromise) {
    const pool = await poolPromise;
    poolPromise = null;
    await pool.close();
  }
}
