import type { ErrorRequestHandler, RequestHandler } from 'express';
import sql from 'mssql';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';

interface RespuestaError {
  status: number;
  mensaje: string;
  detalles?: unknown;
}

// Los SPs lanzan THROW 50xxx donde xxx es el código HTTP (50404, 50409...).
function desdeErrorSql(err: sql.RequestError): RespuestaError | null {
  const numero = err.number;
  if (typeof numero !== 'number') return null;

  if (numero >= 50400 && numero <= 50499) {
    return { status: numero - 50000, mensaje: err.message };
  }
  if (numero === 2627 || numero === 2601) {
    return { status: 409, mensaje: 'El registro ya existe.' };
  }
  if (numero === 547) {
    return { status: 409, mensaje: 'La operacion viola una regla de integridad de los datos.' };
  }
  // Deadlock: SQL Server canceló esta transacción para destrabar otra. Se puede reintentar.
  if (numero === 1205) {
    return { status: 409, mensaje: 'Hubo un conflicto con otra operacion simultanea. Intente de nuevo.' };
  }
  return null;
}

function resolver(err: unknown): RespuestaError {
  if (err instanceof AppError) {
    return { status: err.status, mensaje: err.message };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      mensaje: 'Los datos enviados no son validos.',
      detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    };
  }

  if (err instanceof sql.RequestError) {
    const respuesta = desdeErrorSql(err);
    if (respuesta) return respuesta;
  }

  // JSON mal formado en el body
  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed') {
    return { status: 400, mensaje: 'El cuerpo de la solicitud no es un JSON valido.' };
  }

  console.error(err);
  return { status: 500, mensaje: 'Error interno del servidor.' };
}

export const manejadorErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, mensaje, detalles } = resolver(err);
  res.status(status).json({ error: { mensaje, ...(detalles ? { detalles } : {}) } });
};

export const rutaNoEncontrada: RequestHandler = (req, res) => {
  res.status(404).json({ error: { mensaje: `Ruta no encontrada: ${req.method} ${req.path}` } });
};
