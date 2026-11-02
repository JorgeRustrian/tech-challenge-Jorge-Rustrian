import { z } from 'zod';
import {
  camposRangoFechas,
  errorRangoFechas,
  rangoFechasValido,
  textoBusqueda,
  textoOpcional,
} from '../../utils/esquemas';
import { camposPaginacion } from '../../utils/paginacion';

export const ESTADOS_PEDIDO = [
  'PAGADO',
  'EN_PREPARACION',
  'DESPACHADO',
  'ENTREGADO',
  'CANCELADO',
  'DEVUELTO_PARCIAL',
  'DEVUELTO',
] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const listarMisPedidosSchema = z
  .object({
    estado: z.enum(ESTADOS_PEDIDO).optional(),
    ...camposRangoFechas,
    ...camposPaginacion,
  })
  .refine(rangoFechasValido, errorRangoFechas);

export const listarPedidosSchema = z
  .object({
    estado: z.enum(ESTADOS_PEDIDO).optional(),
    idCliente: z.coerce.number().int().positive().optional(),
    cliente: textoBusqueda,
    ...camposRangoFechas,
    ...camposPaginacion,
  })
  .refine(rangoFechasValido, errorRangoFechas);

// DEVUELTO y DEVUELTO_PARCIAL no se fijan a mano: resultan de registrar devoluciones.
export const cambiarEstadoSchema = z.object({
  estado: z.enum(['EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO']),
  comentario: textoOpcional(250),
});

export const cancelarSchema = z
  .object({
    motivo: textoOpcional(200),
  })
  .optional();

export const devolucionSchema = z.object({
  motivo: z.string().trim().min(3).max(250),
  lineas: z
    .array(
      z.object({
        idPedidoDetalle: z.number().int().positive(),
        cantidad: z.number().int().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(100)
    .refine((ls) => new Set(ls.map((l) => l.idPedidoDetalle)).size === ls.length, 'Cada linea del pedido debe aparecer una sola vez'),
});

export type ListarMisPedidosQuery = z.infer<typeof listarMisPedidosSchema>;
export type ListarPedidosQuery = z.infer<typeof listarPedidosSchema>;
export type DevolucionInput = z.infer<typeof devolucionSchema>;
