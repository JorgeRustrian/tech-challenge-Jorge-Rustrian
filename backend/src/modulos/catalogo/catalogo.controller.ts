import type { Request, Response } from 'express';
import { usuarioActual } from '../../middlewares/autenticar';
import { queryValidada } from '../../middlewares/validar';
import type { BusquedaAdmin, BusquedaTienda } from './catalogo.schemas';
import * as servicio from './catalogo.service';

// Los params ya pasaron por idParamSchema: id es un entero positivo.
function idDe(req: Request): number {
  return Number(req.params.id);
}

/* ---- Tienda ---- */

export async function listarCategoriasTienda(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.listarCategoriasTienda());
}

export async function buscarProductosTienda(req: Request, res: Response): Promise<void> {
  res.json(await servicio.buscarProductosTienda(queryValidada<BusquedaTienda>(req)));
}

export async function obtenerProductoTienda(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtenerProductoTienda(idDe(req)));
}

/* ---- Administración: categorías ---- */

export async function listarCategoriasAdmin(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.listarCategoriasAdmin());
}

export async function crearCategoria(req: Request, res: Response): Promise<void> {
  res.status(201).json(await servicio.crearCategoria(req.body, usuarioActual(req).id));
}

export async function actualizarCategoria(req: Request, res: Response): Promise<void> {
  res.json(await servicio.actualizarCategoria(idDe(req), req.body, usuarioActual(req).id));
}

export async function cambiarEstadoCategoria(req: Request, res: Response): Promise<void> {
  res.json(await servicio.cambiarEstadoCategoria(idDe(req), req.body.activo, usuarioActual(req).id));
}

export async function eliminarCategoria(req: Request, res: Response): Promise<void> {
  await servicio.eliminarCategoria(idDe(req), usuarioActual(req).id);
  res.status(204).end();
}

/* ---- Administración: productos ---- */

export async function buscarProductosAdmin(req: Request, res: Response): Promise<void> {
  res.json(await servicio.buscarProductosAdmin(queryValidada<BusquedaAdmin>(req)));
}

export async function obtenerProductoAdmin(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtenerProductoAdmin(idDe(req)));
}

export async function crearProducto(req: Request, res: Response): Promise<void> {
  res.status(201).json(await servicio.crearProducto(req.body, usuarioActual(req).id));
}

export async function actualizarProducto(req: Request, res: Response): Promise<void> {
  res.json(await servicio.actualizarProducto(idDe(req), req.body, usuarioActual(req).id));
}

export async function cambiarEstadoProducto(req: Request, res: Response): Promise<void> {
  res.json(await servicio.cambiarEstadoProducto(idDe(req), req.body.activo, usuarioActual(req).id));
}

export async function eliminarProducto(req: Request, res: Response): Promise<void> {
  await servicio.eliminarProducto(idDe(req), usuarioActual(req).id);
  res.status(204).end();
}

/* ---- Administración: variantes ---- */

export async function crearVariante(req: Request, res: Response): Promise<void> {
  res.status(201).json(await servicio.crearVariante(idDe(req), req.body, usuarioActual(req).id));
}

export async function actualizarVariante(req: Request, res: Response): Promise<void> {
  res.json(await servicio.actualizarVariante(idDe(req), req.body, usuarioActual(req).id));
}

export async function cambiarEstadoVariante(req: Request, res: Response): Promise<void> {
  res.json(await servicio.cambiarEstadoVariante(idDe(req), req.body.activo, usuarioActual(req).id));
}
