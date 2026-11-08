import { BotonEnlace } from '../componentes/Boton';
import { Vacio } from '../componentes/Estados';

export function NoEncontrada() {
  return (
    <Vacio
      titulo="Esta página no existe"
      texto="Puede que el enlace esté mal escrito o que la página se haya movido."
      accion={
        <BotonEnlace to="/" variante="secundario">
          Ir a la tienda
        </BotonEnlace>
      }
    />
  );
}
