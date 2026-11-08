import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { solicitar, type Parametros } from '../api/cliente';
import type { Paginado } from '../api/tipos';

interface Opciones {
  clave: string;
  ruta: string;
  // Parámetros de la URL que viajan tal cual como filtros a la API.
  filtros: readonly string[];
  tamanio?: number;
  ordenInicial?: string;
  habilitado?: boolean;
}

type Cambios = Record<string, string | number | undefined>;

// Filtros, orden y página viven en la URL: se pueden compartir, sobreviven a recargar la página
// y el botón Atrás regresa a la página anterior del listado. La API pagina, filtra y ordena.
export function useListado<T>({ clave, ruta, filtros, tamanio = 12, ordenInicial, habilitado = true }: Opciones) {
  const [params, setParams] = useSearchParams();

  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const orden = params.get('orden') ?? ordenInicial;
  const valores: Record<string, string> = {};
  for (const nombre of filtros) {
    const valor = params.get(nombre);
    if (valor) valores[nombre] = valor;
  }

  const parametros: Parametros = { ...valores, orden, pagina, tamanio };
  const consulta = useQuery({
    queryKey: [clave, parametros],
    queryFn: ({ signal }) => solicitar<Paginado<T>>(ruta, { parametros, senal: signal }),
    placeholderData: keepPreviousData,
    enabled: habilitado,
  });

  function actualizar(cambios: Cambios, reemplazar: boolean) {
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales);
        for (const [nombre, valor] of Object.entries(cambios)) {
          if (valor === undefined || valor === '') nuevos.delete(nombre);
          else nuevos.set(nombre, String(valor));
        }
        return nuevos;
      },
      { replace: reemplazar },
    );
  }

  return {
    datos: consulta.data?.datos,
    paginacion: consulta.data?.paginacion,
    cargando: consulta.isPending,
    actualizando: consulta.isPlaceholderData,
    error: consulta.error,
    recargar: () => void consulta.refetch(),
    filtros: valores,
    pagina,
    orden,
    // Cambiar un filtro regresa a la primera página.
    cambiarFiltros: (cambios: Cambios) => actualizar({ ...cambios, pagina: undefined }, true),
    cambiarPagina: (n: number) => actualizar({ pagina: n === 1 ? undefined : n }, false),
    cambiarOrden: (nuevo: string) => actualizar({ orden: nuevo, pagina: undefined }, false),
  };
}
