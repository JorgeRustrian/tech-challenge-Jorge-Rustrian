import { z } from 'zod';
import { camposRangoFechas, errorRangoFechas, rangoFechasValido } from '../../utils/esquemas';
import { camposPaginacion } from '../../utils/paginacion';

export const MODULOS_BITACORA = ['CATALOGO', 'INVENTARIO', 'CUPONES', 'PEDIDOS', 'SEGURIDAD'] as const;
export const ACCIONES_BITACORA = ['CREAR', 'MODIFICAR', 'DESACTIVAR', 'ACTIVAR', 'ELIMINAR'] as const;

export const consultarBitacoraSchema = z
  .object({
    modulo: z.enum(MODULOS_BITACORA).optional(),
    entidad: z
      .string()
      .trim()
      .max(50)
      .optional()
      .transform((v) => v || undefined),
    idEntidad: z.coerce.number().int().positive().optional(),
    accion: z.enum(ACCIONES_BITACORA).optional(),
    idUsuario: z.coerce.number().int().positive().optional(),
    ...camposRangoFechas,
    ...camposPaginacion,
  })
  .refine(rangoFechasValido, errorRangoFechas);

export type ConsultarBitacoraQuery = z.infer<typeof consultarBitacoraSchema>;
