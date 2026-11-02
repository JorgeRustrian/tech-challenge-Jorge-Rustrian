import { z } from 'zod';
import { codigoCuponSchema } from '../cupones/cupones.schemas';

// El token lo genera la BD (NEWID) y el cliente lo guarda y lo envía en X-Carrito-Token.
export const tokenInvitadoSchema = z.string().trim().toLowerCase().pipe(z.uuid());

const cantidad = z.number().int().min(1).max(1000);

export const agregarItemSchema = z.object({
  idVariante: z.number().int().positive(),
  cantidad,
});

export const actualizarItemSchema = z.object({ cantidad });

export const varianteParamSchema = z.object({
  idVariante: z.coerce.number().int().positive(),
});

export const aplicarCuponSchema = z.object({
  codigo: codigoCuponSchema,
});

export type AgregarItemInput = z.infer<typeof agregarItemSchema>;
