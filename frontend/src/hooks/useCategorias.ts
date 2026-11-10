import { useQuery } from '@tanstack/react-query';
import { obtenerCategorias } from '../api/catalogo';

// Las categorías cambian poco: se piden una vez y se reutilizan entre páginas.
export function useCategorias() {
  return useQuery({
    queryKey: ['categorias-tienda'],
    queryFn: ({ signal }) => obtenerCategorias(signal),
    staleTime: 5 * 60_000,
  });
}
