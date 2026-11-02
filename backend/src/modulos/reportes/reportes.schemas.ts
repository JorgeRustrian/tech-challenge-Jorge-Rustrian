import { z } from 'zod';
import { camposRangoFechas, errorRangoFechas, rangoFechasValido } from '../../utils/esquemas';
import { camposPaginacion } from '../../utils/paginacion';

// Sin fechas: últimos 30 días. soloEntregados=true cuenta solo pedidos entregados (con o sin devoluciones).
const camposRango = {
  ...camposRangoFechas,
  soloEntregados: z.stringbool().default(false),
};

export const rangoReporteSchema = z.object(camposRango).refine(rangoFechasValido, errorRangoFechas);

export const ventasPorPeriodoSchema = z
  .object({ ...camposRango, agrupacion: z.enum(['dia', 'semana', 'mes']).default('dia') })
  .refine(rangoFechasValido, errorRangoFechas);

export const productosMasVendidosSchema = z
  .object({ ...camposRango, top: z.coerce.number().int().min(1).max(50).default(10) })
  .refine(rangoFechasValido, errorRangoFechas);

export const carritosAbandonadosSchema = z.object({
  minutosInactividad: z.coerce.number().int().min(1).max(525_600).optional(),
  ...camposPaginacion,
});

export type RangoReporteQuery = z.infer<typeof rangoReporteSchema>;
export type VentasPorPeriodoQuery = z.infer<typeof ventasPorPeriodoSchema>;
export type ProductosMasVendidosQuery = z.infer<typeof productosMasVendidosSchema>;
export type CarritosAbandonadosQuery = z.infer<typeof carritosAbandonadosSchema>;
