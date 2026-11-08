import type { ReactNode } from 'react';
import css from './EncabezadoPagina.module.css';

interface Props {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  antetitulo?: ReactNode;
}

export function EncabezadoPagina({ titulo, descripcion, acciones, antetitulo }: Props) {
  return (
    <header className={css.encabezado}>
      <div>
        {antetitulo && <p className={css.antetitulo}>{antetitulo}</p>}
        <h1>{titulo}</h1>
        {descripcion && <p className={css.descripcion}>{descripcion}</p>}
      </div>
      {acciones && <div className={css.acciones}>{acciones}</div>}
    </header>
  );
}
