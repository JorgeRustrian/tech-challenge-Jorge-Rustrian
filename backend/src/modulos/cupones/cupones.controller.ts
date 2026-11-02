import type { Request, Response } from 'express';
import { usuarioActual } from '../../middlewares/autenticar';
import { queryValidada } from '../../middlewares/validar';
import type { ListarCuponesQuery } from './cupones.schemas';
import * as servicio from './cupones.service';

function idDe(req: Request): number {
  return Number(req.params.id);
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(queryValidada<ListarCuponesQuery>(req)));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idDe(req)));
}

export async function crear(req: Request, res: Response): Promise<void> {
  res.status(201).json(await servicio.crear(req.body, usuarioActual(req).id));
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.actualizar(idDe(req), req.body, usuarioActual(req).id));
}

export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  res.json(await servicio.cambiarEstado(idDe(req), req.body.activo, usuarioActual(req).id));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idDe(req), usuarioActual(req).id);
  res.status(204).end();
}
