import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const estadoSchema = z.object({
  activo: z.boolean(),
});

// DECIMAL(12,2): máximo dos decimales. Se compara con tolerancia por la representación binaria de los decimales en JS.
export const montoSchema = z
  .number()
  .nonnegative()
  .max(9_999_999_999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Admite como maximo 2 decimales');

// Filtro de búsqueda: '' o solo espacios cuentan como "sin filtro".
export const textoBusqueda = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v || undefined);

// Filtro por días calendario (AAAA-MM-DD, hora de Guatemala); los SPs los convierten a UTC.
export const camposRangoFechas = {
  fechaDesde: z.iso.date().optional(),
  fechaHasta: z.iso.date().optional(),
};

export function rangoFechasValido(f: { fechaDesde?: string; fechaHasta?: string }): boolean {
  return !f.fechaDesde || !f.fechaHasta || f.fechaDesde <= f.fechaHasta;
}

export const errorRangoFechas = {
  message: 'fechaDesde no puede ser posterior a fechaHasta',
  path: ['fechaDesde'],
};

// Texto opcional donde '' se trata como "sin valor".
export function textoOpcional(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
}
