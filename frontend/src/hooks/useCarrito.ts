import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAVE_CARRITO, obtenerCarrito, type Carrito } from '../api/carrito';
import { ErrorApi } from '../api/cliente';
import { useSesion } from '../auth/sesion';

// Administradores y operadores no compran: para ellos no se pide ni se muestra carrito.
export function usePuedeComprar(): boolean {
  const { usuario } = useSesion();
  return !usuario || usuario.rol === 'CLIENTE';
}

export function useCarrito() {
  const { lista } = useSesion();
  const puedeComprar = usePuedeComprar();
  // Se espera a saber si hay sesión: antes de eso se pediría el carrito de invitado por error.
  return useQuery({
    queryKey: CLAVE_CARRITO,
    queryFn: ({ signal }) => obtenerCarrito(signal),
    enabled: lista && puedeComprar,
  });
}

let huboConcurrencia = false;

// Cada acción del carrito responde con el carrito completo, que reemplaza al que está en caché.
export function useAccionCarrito<A extends unknown[]>(accion: (...args: A) => Promise<Carrito>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: CLAVE_CARRITO,
    mutationFn: (args: A) => accion(...args),
    onSettled: (carrito, error) => {
      // Si hubo otras acciones a la vez, sus respuestas pueden llegar en otro orden:
      // la última en terminar vuelve a pedir el carrito en lugar de confiar en su respuesta.
      if (queryClient.isMutating({ mutationKey: CLAVE_CARRITO }) > 1) {
        huboConcurrencia = true;
        return;
      }
      if (carrito && !huboConcurrencia) {
        queryClient.setQueryData(CLAVE_CARRITO, carrito);
        return;
      }
      // Un dato rechazado (400, 422) o el límite de intentos (429) no cambian el carrito; un 409 o un 404
      // sí indican que la existencia o las líneas ya no son las que se ven.
      const sinCambios = error instanceof ErrorApi && [400, 422, 429].includes(error.status);
      if (huboConcurrencia || !sinCambios) void queryClient.invalidateQueries({ queryKey: CLAVE_CARRITO });
      huboConcurrencia = false;
    },
  });
}
