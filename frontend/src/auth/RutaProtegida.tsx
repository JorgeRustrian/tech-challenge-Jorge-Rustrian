import { Navigate, Outlet, useLocation } from 'react-router';
import type { Rol } from '../api/tipos';
import { Cargando } from '../componentes/Estados';
import { SinPermiso } from '../paginas/SinPermiso';
import { useSesion } from './sesion';

// La API valida los permisos de verdad; esto solo evita mostrar pantallas que van a responder 403.
export function RutaProtegida({ roles }: { roles: Rol[] }) {
  const { usuario, lista } = useSesion();
  const ubicacion = useLocation();

  if (!lista) return <Cargando texto="Verificando sesión" />;
  if (!usuario) {
    return <Navigate to="/entrar" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  }
  if (!roles.includes(usuario.rol)) return <SinPermiso />;
  return <Outlet />;
}
