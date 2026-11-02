import { z } from 'zod';
import { montoSchema, textoBusqueda, textoOpcional } from '../../utils/esquemas';
import { camposPaginacion } from '../../utils/paginacion';

export const ESTADOS_CUPON = ['VIGENTE', 'PROGRAMADO', 'VENCIDO', 'AGOTADO', 'INACTIVO'] as const;

export const codigoCuponSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(30)
  .regex(/^[A-Z0-9_-]+$/, 'El codigo solo admite letras, numeros, guion y guion bajo');

export const listarCuponesSchema = z.object({
  texto: textoBusqueda,
  estado: z.enum(ESTADOS_CUPON).optional(),
  ...camposPaginacion,
});

// Fechas en ISO 8601 con zona (ej. 2026-12-01T00:00:00-06:00); se guardan en UTC.
export const cuponSchema = z
  .object({
    codigo: codigoCuponSchema,
    descripcion: textoOpcional(250),
    tipoDescuento: z.enum(['PORCENTAJE', 'MONTO']),
    valor: montoSchema.refine((v) => v > 0, 'El valor debe ser mayor que cero'),
    montoMinimo: montoSchema.default(0),
    fechaInicio: z.iso.datetime({ offset: true }),
    fechaFin: z.iso.datetime({ offset: true }),
    limiteUsosTotal: z.number().int().min(1).max(1_000_000),
    limiteUsosCliente: z.number().int().min(1).max(1_000_000).default(1),
    idCategoria: z.number().int().positive().nullable().default(null),
  })
  .refine((c) => c.tipoDescuento !== 'PORCENTAJE' || c.valor <= 100, {
    message: 'Un porcentaje no puede ser mayor que 100',
    path: ['valor'],
  })
  .refine((c) => new Date(c.fechaFin) > new Date(c.fechaInicio), {
    message: 'fechaFin debe ser posterior a fechaInicio',
    path: ['fechaFin'],
  })
  .refine((c) => c.limiteUsosCliente <= c.limiteUsosTotal, {
    message: 'El limite por cliente no puede ser mayor que el limite total',
    path: ['limiteUsosCliente'],
  });

export type ListarCuponesQuery = z.infer<typeof listarCuponesSchema>;
export type CuponInput = z.infer<typeof cuponSchema>;
