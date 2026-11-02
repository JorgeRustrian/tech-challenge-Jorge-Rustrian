import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import { verificarAccessToken } from '../modulos/auth/tokens';
import type { Rol, UsuarioAutenticado } from '../tipos/auth';

// 401: no hay token, es inválido o expiró.
export const autenticar: RequestHandler = (req, _res, next) => {
  const encabezado = req.headers.authorization;
  if (!encabezado?.startsWith('Bearer ')) {
    throw new AppError(401, 'Falta el token de acceso.');
  }

  try {
    req.usuario = verificarAccessToken(encabezado.slice('Bearer '.length));
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'El token de acceso expiro.');
    }
    throw new AppError(401, 'Token de acceso invalido.');
  }

  next();
};

// Para rutas que aceptan invitados. Si viene token se valida igual que en autenticar
// (uno vencido sigue siendo 401, para que el cliente lo renueve); si no viene, sigue como invitado.
export const autenticacionOpcional: RequestHandler = (req, res, next) => {
  if (!req.headers.authorization) {
    next();
    return;
  }
  autenticar(req, res, next);
};

// 403: el token es válido pero el rol no tiene permiso. Va siempre después de autenticar.
export function autorizar(...roles: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(usuarioActual(req).rol)) {
      throw new AppError(403, 'No tiene permiso para realizar esta accion.');
    }
    next();
  };
}

export function usuarioActual(req: Request): UsuarioAutenticado {
  if (!req.usuario) {
    throw new AppError(401, 'No autenticado.');
  }
  return req.usuario;
}
