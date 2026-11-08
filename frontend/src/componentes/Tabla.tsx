import type { ReactNode } from 'react';
import { Cargando, ErrorVista, Vacio } from './Estados';
import css from './Tabla.module.css';

export interface Columna<T> {
  clave: string;
  titulo: string;
  celda: (fila: T) => ReactNode;
  alinear?: 'derecha' | 'centro';
  // Valor del parámetro `orden` de la API: uno solo, o [ascendente, descendente].
  orden?: string | readonly [string, string];
  ancho?: string;
}

interface TablaProps<T> {
  columnas: Columna<T>[];
  filas: T[] | undefined;
  claveFila: (fila: T) => string | number;
  cargando: boolean;
  error: unknown;
  alReintentar?: () => void;
  vacio: { titulo: string; texto?: string };
  // Hay datos en pantalla pero se está pidiendo otra página o filtro.
  actualizando?: boolean;
  orden?: string;
  alOrdenar?: (orden: string) => void;
}

function siguienteOrden(orden: string | readonly [string, string], actual?: string): string {
  if (typeof orden === 'string') return orden;
  return actual === orden[0] ? orden[1] : orden[0];
}

function sentido(orden: string | readonly [string, string], actual?: string): 'ascending' | 'descending' | undefined {
  if (typeof orden === 'string') return actual === orden ? 'ascending' : undefined;
  if (actual === orden[0]) return 'ascending';
  if (actual === orden[1]) return 'descending';
  return undefined;
}

export function Tabla<T>({ columnas, filas, claveFila, cargando, error, alReintentar, vacio, actualizando, orden, alOrdenar }: TablaProps<T>) {
  let estado: ReactNode = null;
  if (!filas) {
    estado = cargando ? <Cargando /> : error ? <ErrorVista error={error} alReintentar={alReintentar} /> : null;
  } else if (filas.length === 0) {
    estado = <Vacio titulo={vacio.titulo} texto={vacio.texto} />;
  }

  return (
    <div className={css.marco}>
      <table className={css.tabla}>
        <thead>
          <tr>
            {columnas.map((col) => {
              const dir = col.orden ? sentido(col.orden, orden) : undefined;
              return (
                <th
                  key={col.clave}
                  scope="col"
                  className={col.alinear ? css[col.alinear] : undefined}
                  style={col.ancho ? { width: col.ancho } : undefined}
                  aria-sort={dir}
                >
                  {col.orden && alOrdenar ? (
                    <button
                      type="button"
                      className={`${css.ordenar} ${dir ? css.activo : ''}`}
                      onClick={() => alOrdenar(siguienteOrden(col.orden!, orden))}
                    >
                      {col.titulo}
                      <span aria-hidden="true">{dir === 'descending' ? '↓' : dir ? '↑' : '↕'}</span>
                    </button>
                  ) : (
                    col.titulo
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={actualizando ? css.actualizando : undefined}>
          {estado ? (
            <tr>
              <td colSpan={columnas.length} className={css.celdaEstado}>
                {estado}
              </td>
            </tr>
          ) : (
            filas?.map((fila) => (
              <tr key={claveFila(fila)}>
                {columnas.map((col) => (
                  <td key={col.clave} className={col.alinear ? css[col.alinear] : undefined}>
                    {col.celda(fila)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
