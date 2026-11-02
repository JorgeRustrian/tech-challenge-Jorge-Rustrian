import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { usuarioActual } from '../../middlewares/autenticar';
import * as servicio from './auth.service';

const COOKIE_REFRESH = 'refreshToken';

// httpOnly: el JavaScript del navegador no puede leerla (protege contra XSS).
// sameSite strict: no viaja en peticiones originadas desde otro sitio (protege contra CSRF).
const opcionesCookie: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
};

function responderSesion(res: Response, sesion: servicio.Sesion, status = 200): void {
  res.cookie(COOKIE_REFRESH, sesion.refreshToken, {
    ...opcionesCookie,
    maxAge: env.REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000,
  });
  res.status(status).json({ accessToken: sesion.accessToken, usuario: sesion.usuario });
}

function leerRefreshToken(req: Request): string | undefined {
  const valor: unknown = req.cookies?.[COOKIE_REFRESH];
  return typeof valor === 'string' ? valor : undefined;
}

export async function registro(req: Request, res: Response): Promise<void> {
  responderSesion(res, await servicio.registrar(req.body), 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  responderSesion(res, await servicio.iniciarSesion(req.body));
}

export async function refrescar(req: Request, res: Response): Promise<void> {
  try {
    responderSesion(res, await servicio.refrescarSesion(leerRefreshToken(req)));
  } catch (err) {
    res.clearCookie(COOKIE_REFRESH, opcionesCookie);
    throw err;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await servicio.cerrarSesion(leerRefreshToken(req));
  res.clearCookie(COOKIE_REFRESH, opcionesCookie);
  res.status(204).end();
}

export async function perfil(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtenerPerfil(usuarioActual(req).id));
}
