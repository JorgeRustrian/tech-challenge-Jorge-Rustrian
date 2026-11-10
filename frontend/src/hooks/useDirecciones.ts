import { useQuery } from '@tanstack/react-query';
import { CLAVE_DIRECCIONES, listarDirecciones } from '../api/direcciones';

export function useDirecciones() {
  return useQuery({
    queryKey: CLAVE_DIRECCIONES,
    queryFn: ({ signal }) => listarDirecciones(signal),
  });
}
