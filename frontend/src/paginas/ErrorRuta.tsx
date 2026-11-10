import { useRouteError } from 'react-router';
import { Boton } from '../componentes/Boton';
import { Vacio } from '../componentes/Estados';

// Un error de programación en una pantalla no deja la página en blanco.
export function ErrorRuta() {
  const error = useRouteError();
  console.error(error);
  return (
    <Vacio
      titulo="Algo salió mal al mostrar esta página"
      texto="Recargue la página. Si el problema sigue, avísenos."
      accion={<Boton onClick={() => window.location.reload()}>Recargar</Boton>}
    />
  );
}
