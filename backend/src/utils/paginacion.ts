import { z } from 'zod';

// Campos para mezclar en los esquemas de query de cualquier listado.
export const camposPaginacion = {
  pagina: z.coerce.number().int().min(1).default(1),
  tamanio: z.coerce.number().int().min(1).max(100).default(12),
};

export interface Paginado<T> {
  datos: T[];
  paginacion: {
    pagina: number;
    tamanio: number;
    total: number;
    totalPaginas: number;
  };
}

export function paginar<T>(datos: T[], total: number, pagina: number, tamanio: number): Paginado<T> {
  return {
    datos,
    paginacion: { pagina, tamanio, total, totalPaginas: Math.ceil(total / tamanio) },
  };
}
