import type { Request, Response } from 'express';
import { queryValidada } from '../../middlewares/validar';
import type { ConsultarBitacoraQuery } from './bitacora.schemas';
import * as servicio from './bitacora.service';

export async function consultar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.consultar(queryValidada<ConsultarBitacoraQuery>(req)));
}
