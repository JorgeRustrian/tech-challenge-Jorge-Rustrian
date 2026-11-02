import { z } from 'zod';

export const pagarSchema = z.object({
  idDireccion: z.number().int().positive(),
});

// La genera el cliente una vez por intento de pago y la repite en cada reintento.
export const claveIdempotenciaSchema = z.string().trim().toLowerCase().pipe(z.uuid());
