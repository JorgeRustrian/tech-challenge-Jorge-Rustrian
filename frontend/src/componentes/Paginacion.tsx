import type { Paginacion as DatosPaginacion } from '../api/tipos';
import { IconoFlecha } from './Iconos';
import css from './Paginacion.module.css';

// 1 … 4 5 6 … 12: siempre la primera, la última y las vecinas de la actual.
function numeros(actual: number, total: number): (number | null)[] {
  const visibles = new Set([1, total, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= total));
  const ordenados = [...visibles].sort((a, b) => a - b);
  const resultado: (number | null)[] = [];
  ordenados.forEach((n, i) => {
    if (i > 0 && n - ordenados[i - 1] > 1) resultado.push(null);
    resultado.push(n);
  });
  return resultado;
}

export function Paginacion({ paginacion, alCambiar }: { paginacion: DatosPaginacion; alCambiar: (pagina: number) => void }) {
  const { pagina, tamanio, total, totalPaginas } = paginacion;
  if (total === 0) return null;

  const desde = (pagina - 1) * tamanio + 1;
  const hasta = Math.min(pagina * tamanio, total);

  return (
    <nav className={css.paginacion} aria-label="Paginación">
      <p className={`${css.resumen} cifras`}>
        {desde}–{hasta} de {total}
      </p>
      {totalPaginas > 1 && (
        <div className={css.paginas}>
          <button type="button" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)} aria-label="Página anterior">
            <IconoFlecha direccion="izquierda" width={16} height={16} />
          </button>
          {numeros(pagina, totalPaginas).map((n, i) =>
            n === null ? (
              <span key={`salto-${i}`} className={css.salto}>
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className="cifras"
                aria-current={n === pagina ? 'page' : undefined}
                onClick={() => alCambiar(n)}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" disabled={pagina >= totalPaginas} onClick={() => alCambiar(pagina + 1)} aria-label="Página siguiente">
            <IconoFlecha width={16} height={16} />
          </button>
        </div>
      )}
    </nav>
  );
}
