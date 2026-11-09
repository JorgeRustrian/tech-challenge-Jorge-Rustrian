import { useQueryClient } from '@tanstack/react-query';
import { useSesion } from '../../../auth/sesion';

// El Operador ve el catálogo (lo necesita para inventario y pedidos), pero solo el Administrador lo cambia.
export function usePuedeEditarCatalogo(): boolean {
  return useSesion().usuario?.rol === 'ADMIN';
}

// Un cambio en el catálogo se ve en la tienda, en el inventario y en los filtros del panel.
export function useAlCambiarCatalogo() {
  const queryClient = useQueryClient();
  return () => {
    for (const clave of ['categorias-panel', 'categorias-tienda', 'panel-productos', 'catalogo', 'producto', 'existencias', 'kardex']) {
      void queryClient.invalidateQueries({ queryKey: [clave] });
    }
  };
}
