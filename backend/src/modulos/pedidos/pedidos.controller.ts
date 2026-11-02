import type { Request, Response } from 'express';
import { usuarioActual } from '../../middlewares/autenticar';
import { queryValidada } from '../../middlewares/validar';
import type { ListarMisPedidosQuery, ListarPedidosQuery } from './pedidos.schemas';
import * as servicio from './pedidos.service';

function idDe(req: Request): number {
  return Number(req.params.id);
}

/* ---- Cliente ---- */

export async function listarMisPedidos(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listarMisPedidos(usuarioActual(req).id, queryValidada<ListarMisPedidosQuery>(req)));
}

export async function obtenerMiPedido(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtenerMiPedido(usuarioActual(req).id, idDe(req)));
}

export async function cancelarMiPedido(req: Request, res: Response): Promise<void> {
  res.json(await servicio.cancelarMiPedido(usuarioActual(req).id, idDe(req), req.body?.motivo ?? null));
}

/* ---- Operador y Administrador ---- */

export async function listarPedidos(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listarPedidos(queryValidada<ListarPedidosQuery>(req)));
}

export async function obtenerPedido(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtenerPedido(idDe(req)));
}

export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  res.json(await servicio.cambiarEstado(idDe(req), req.body.estado, req.body.comentario, usuarioActual(req).id));
}

export async function registrarDevolucion(req: Request, res: Response): Promise<void> {
  res.status(201).json(await servicio.registrarDevolucion(idDe(req), req.body, usuarioActual(req).id));
}
