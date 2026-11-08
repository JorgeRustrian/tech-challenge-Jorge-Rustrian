import { useSesion } from '../auth/sesion';
import { inicioSegunRol } from '../auth/roles';
import { BotonEnlace } from '../componentes/Boton';
import { Vacio } from '../componentes/Estados';

export function SinPermiso() {
  const { usuario } = useSesion();
  return (
    <Vacio
      titulo="No tiene permiso para ver esta sección"
      texto="Si cree que es un error, pida acceso a un administrador."
      accion={
        <BotonEnlace to={usuario ? inicioSegunRol(usuario.rol) : '/'} variante="secundario">
          Volver al inicio
        </BotonEnlace>
      }
    />
  );
}
