import type { Request, Response } from 'express';
import { usuarioActual } from '../../middlewares/autenticar';
import * as servicio from './direcciones.service';

function idDe(req: Request): number {
  return Number(req.params.id);
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(usuarioActual(req).id));
}

export async function crear(req: Request, res: Response): Promise<void> {
  res.status(201).json(await servicio.crear(usuarioActual(req).id, req.body));
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.actualizar(usuarioActual(req).id, idDe(req), req.body));
}

export async function marcarPredeterminada(req: Request, res: Response): Promise<void> {
  res.json(await servicio.marcarPredeterminada(usuarioActual(req).id, idDe(req)));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(usuarioActual(req).id, idDe(req));
  res.status(204).end();
}
