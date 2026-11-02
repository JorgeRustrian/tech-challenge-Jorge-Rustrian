import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface Esquemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

// Si falla, parse lanza ZodError y lo atrapa manejadorErrores (400).
export function validar(esquemas: Esquemas): RequestHandler {
  return (req, _res, next) => {
    if (esquemas.body) {
      req.body = esquemas.body.parse(req.body);
    }
    if (esquemas.params) {
      req.params = esquemas.params.parse(req.params) as typeof req.params;
    }
    if (esquemas.query) {
      // En Express 5 req.query es solo lectura; se redefine con los valores ya convertidos.
      Object.defineProperty(req, 'query', { value: esquemas.query.parse(req.query), writable: true });
    }
    next();
  };
}

// Después de validar({ query }), req.query ya tiene los valores convertidos por el esquema.
export function queryValidada<T>(req: Request): T {
  return req.query as unknown as T;
}
