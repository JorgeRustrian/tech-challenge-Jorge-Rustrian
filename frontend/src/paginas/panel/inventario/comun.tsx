import css from './Inventario.module.css';

export const UMBRAL_EXISTENCIA_BAJA = 5;

export function descripcionVariante(v: { producto: string; talla: string | null; color: string | null }): string {
  return [v.producto, v.talla && `talla ${v.talla}`, v.color].filter(Boolean).join(' · ');
}

// Agotado en rojo y existencia baja en ocre, para que salten a la vista en la tabla.
export function Disponible({ n }: { n: number }) {
  const clase = n <= 0 ? css.sinExistencia : n <= UMBRAL_EXISTENCIA_BAJA ? css.baja : undefined;
  return <span className={clase}>{n}</span>;
}
