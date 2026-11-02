import type { Request, Response } from 'express';
import { AppError } from '../../errors/AppError';
import { usuarioActual } from '../../middlewares/autenticar';
import type { DuenioCarrito } from './carrito.repository';
import { tokenInvitadoSchema } from './carrito.schemas';
import * as servicio from './carrito.service';

const ENCABEZADO_TOKEN = 'x-carrito-token';

function tokenDelEncabezado(req: Request): string | null {
  const valor = req.header(ENCABEZADO_TOKEN);
  if (!valor) return null;

  const token = tokenInvitadoSchema.safeParse(valor);
  if (!token.success) {
    throw new AppError(400, 'El token del carrito no es valido.');
  }
  return token.data;
}

// Con sesión el carrito es el del usuario y el token se ignora; sin sesión, el del token de invitado.
function duenioDe(req: Request): DuenioCarrito {
  if (req.usuario) {
    return { idUsuario: req.usuario.id, tokenInvitado: null };
  }
  return { idUsuario: null, tokenInvitado: tokenDelEncabezado(req) };
}

function idVarianteDe(req: Request): number {
  return Number(req.params.idVariante);
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(duenioDe(req)));
}

export async function agregarItem(req: Request, res: Response): Promise<void> {
  res.json(await servicio.agregarItem(duenioDe(req), req.body.idVariante, req.body.cantidad));
}

export async function actualizarItem(req: Request, res: Response): Promise<void> {
  res.json(await servicio.actualizarItem(duenioDe(req), idVarianteDe(req), req.body.cantidad));
}

export async function eliminarItem(req: Request, res: Response): Promise<void> {
  res.json(await servicio.eliminarItem(duenioDe(req), idVarianteDe(req)));
}

export async function vaciar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.vaciar(duenioDe(req)));
}

export async function aplicarCupon(req: Request, res: Response): Promise<void> {
  res.json(await servicio.aplicarCupon(duenioDe(req), req.body.codigo));
}

export async function quitarCupon(req: Request, res: Response): Promise<void> {
  res.json(await servicio.quitarCupon(duenioDe(req)));
}

// Se llama justo después de iniciar sesión, con el token del carrito que se usó como invitado.
export async function fusionar(req: Request, res: Response): Promise<void> {
  const idUsuario = usuarioActual(req).id;
  const token = tokenDelEncabezado(req);
  if (!token) {
    throw new AppError(400, 'Falta el encabezado X-Carrito-Token con el carrito de invitado.');
  }
  res.json(await servicio.fusionar(idUsuario, token));
}
