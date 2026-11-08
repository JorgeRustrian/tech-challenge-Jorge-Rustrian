import { EncabezadoPagina } from '../componentes/EncabezadoPagina';
import { Vacio } from '../componentes/Estados';
import { useTitulo } from '../hooks/useTitulo';

// Marcador temporal para las rutas que se construyen en las fases siguientes.
export function Pendiente({ titulo }: { titulo: string }) {
  useTitulo(titulo);
  return (
    <>
      <EncabezadoPagina titulo={titulo} />
      <Vacio titulo="Sección en construcción" />
    </>
  );
}
