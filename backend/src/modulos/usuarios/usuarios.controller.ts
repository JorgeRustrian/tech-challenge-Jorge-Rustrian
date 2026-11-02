import type { Request, Response } from 'express';
import { usuarioActual } from '../../middlewares/autenticar';
import { queryValidada } from '../../middlewares/validar';
import type { ListarUsuariosQuery } from './usuarios.schemas';
import * as servicio from './usuarios.service';

function idDe(req: Request): number {
  return Number(req.params.id);
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(queryValidada<ListarUsuariosQuery>(req), usuarioActual(req).id));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idDe(req), usuarioActual(req).id));
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

export async function cambiarPassword(req: Request, res: Response): Promise<void> {
  await servicio.cambiarPassword(idDe(req), req.body.password, usuarioActual(req).id);
  res.status(204).end();
}
