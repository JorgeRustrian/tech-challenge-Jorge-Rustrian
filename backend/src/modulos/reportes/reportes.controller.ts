import type { Request, Response } from 'express';
import { queryValidada } from '../../middlewares/validar';
import type {
  CarritosAbandonadosQuery,
  ProductosMasVendidosQuery,
  RangoReporteQuery,
  VentasPorPeriodoQuery,
} from './reportes.schemas';
import * as servicio from './reportes.service';

export async function resumen(req: Request, res: Response): Promise<void> {
  res.json(await servicio.resumen(queryValidada<RangoReporteQuery>(req)));
}

export async function ventasPorPeriodo(req: Request, res: Response): Promise<void> {
  res.json(await servicio.ventasPorPeriodo(queryValidada<VentasPorPeriodoQuery>(req)));
}

export async function ventasPorCategoria(req: Request, res: Response): Promise<void> {
  res.json(await servicio.ventasPorCategoria(queryValidada<RangoReporteQuery>(req)));
}

export async function productosMasVendidos(req: Request, res: Response): Promise<void> {
  res.json(await servicio.productosMasVendidos(queryValidada<ProductosMasVendidosQuery>(req)));
}

export async function carritosAbandonados(req: Request, res: Response): Promise<void> {
  res.json(await servicio.carritosAbandonados(queryValidada<CarritosAbandonadosQuery>(req)));
}
