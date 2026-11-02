import type { Request, Response } from 'express';
import { AppError } from '../../errors/AppError';
import { usuarioActual } from '../../middlewares/autenticar';
import { claveIdempotenciaSchema } from './checkout.schemas';
import * as servicio from './checkout.service';

function claveIdempotenciaDe(req: Request): string {
  const clave = claveIdempotenciaSchema.safeParse(req.header('idempotency-key') ?? '');
  if (!clave.success) {
    throw new AppError(400, 'El encabezado Idempotency-Key es obligatorio y debe ser un UUID.');
  }
  return clave.data;
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(usuarioActual(req).id));
}

export async function iniciarPago(req: Request, res: Response): Promise<void> {
  res.json(await servicio.iniciarPago(usuarioActual(req).id));
}

// 201 la primera vez; 200 con el mismo pedido si la clave ya se había usado.
export async function pagar(req: Request, res: Response): Promise<void> {
  const clave = claveIdempotenciaDe(req);
  const { repetido, pedido } = await servicio.pagar(usuarioActual(req).id, req.body.idDireccion, clave);

  if (repetido) {
    res.setHeader('Idempotent-Replayed', 'true');
  }
  res.status(repetido ? 200 : 201).json(pedido);
}
