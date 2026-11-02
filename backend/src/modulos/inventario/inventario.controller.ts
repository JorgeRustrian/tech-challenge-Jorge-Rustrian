import type { Request, Response } from 'express';
import { usuarioActual } from '../../middlewares/autenticar';
import { queryValidada } from '../../middlewares/validar';
import type { ExistenciasQuery, KardexQuery } from './inventario.schemas';
import * as servicio from './inventario.service';

function idDe(req: Request): number {
  return Number(req.params.id);
}

export async function listarExistencias(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listarExistencias(queryValidada<ExistenciasQuery>(req)));
}

export async function listarKardex(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listarKardex(idDe(req), queryValidada<KardexQuery>(req)));
}

export async function registrarEntrada(req: Request, res: Response): Promise<void> {
  res.status(201).json(await servicio.registrarEntrada(idDe(req), req.body, usuarioActual(req).id));
}

export async function registrarAjuste(req: Request, res: Response): Promise<void> {
  res.status(201).json(await servicio.registrarAjuste(idDe(req), req.body, usuarioActual(req).id));
}

export async function conciliar(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.conciliar());
}
