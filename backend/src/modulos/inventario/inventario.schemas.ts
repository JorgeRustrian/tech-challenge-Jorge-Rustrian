import { z } from 'zod';
import { camposRangoFechas, errorRangoFechas, rangoFechasValido, textoBusqueda } from '../../utils/esquemas';
import { camposPaginacion } from '../../utils/paginacion';

export const TIPOS_MOVIMIENTO = ['ENTRADA', 'VENTA', 'AJUSTE', 'DEVOLUCION', 'CANCELACION'] as const;

export const existenciasQuerySchema = z.object({
  texto: textoBusqueda,
  idCategoria: z.coerce.number().int().positive().optional(),
  existenciaMaxima: z.coerce.number().int().min(0).optional(),
  activo: z.stringbool().optional(),
  orden: z.enum(['sku', 'disponible']).default('sku'),
  ...camposPaginacion,
});

export const kardexQuerySchema = z
  .object({
    tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
    ...camposRangoFechas,
    ...camposPaginacion,
  })
  .refine(rangoFechasValido, errorRangoFechas);

const motivo = z.string().trim().min(3).max(250);

export const entradaSchema = z.object({
  cantidad: z.number().int().min(1).max(1_000_000),
  motivo,
});

export const ajusteSchema = z.object({
  cantidad: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((v) => v !== 0, 'La cantidad del ajuste no puede ser cero'),
  motivo,
});

export type ExistenciasQuery = z.infer<typeof existenciasQuerySchema>;
export type KardexQuery = z.infer<typeof kardexQuerySchema>;
export type MovimientoInput = z.infer<typeof entradaSchema>;
