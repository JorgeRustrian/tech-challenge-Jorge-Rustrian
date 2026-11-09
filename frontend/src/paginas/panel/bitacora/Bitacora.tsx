import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ACCIONES_BITACORA, MODULOS_BITACORA, type EntradaBitacora, type Valores } from '../../../api/bitacora';
import { Boton } from '../../../componentes/Boton';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { Cargando, ErrorVista, Vacio } from '../../../componentes/Estados';
import { BarraFiltros, CampoSeleccion, FiltroFechas } from '../../../componentes/Filtros';
import { Insignia, type Tono } from '../../../componentes/Insignia';
import { Paginacion } from '../../../componentes/Paginacion';
import { useListado } from '../../../hooks/useListado';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoFechaHora } from '../../../utils/formato';
import css from '../Administracion.module.css';

const TONO_ACCION: Record<string, Tono> = {
  CREAR: 'exito',
  MODIFICAR: 'info',
  ACTIVAR: 'marca',
  DESACTIVAR: 'aviso',
  ELIMINAR: 'peligro',
};

// Nombre para mostrar y, si existe, la pantalla donde se puede ver la entidad.
const ENTIDADES: Record<string, { nombre: string; enlace?: (id: number) => string }> = {
  Productos: { nombre: 'Producto', enlace: (id) => `/panel/productos/${id}` },
  Categorias: { nombre: 'Categoría', enlace: () => '/panel/categorias' },
  Variantes: { nombre: 'Variante', enlace: (id) => `/panel/inventario/${id}` },
  Cupones: { nombre: 'Cupón' },
  Usuarios: { nombre: 'Cuenta' },
  Pedidos: { nombre: 'Pedido', enlace: (id) => `/panel/pedidos/${id}` },
  Devoluciones: { nombre: 'Devolución' },
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function valorLegible(v: unknown): ReactNode {
  if (v === null || v === undefined || v === '') return <span className={css.tenue}>—</span>;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'string' && FECHA_ISO.test(v)) return formatoFechaHora(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className={css.tenue}>Ninguno</span>;
    return (
      <ul className={css.listaValores}>
        {v.map((item, i) => (
          <li key={i}>
            {item && typeof item === 'object'
              ? Object.entries(item)
                  .map(([k, x]) => `${k}: ${x ?? '—'}`)
                  .join(' · ')
              : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// Un alta muestra lo creado, una baja lo que había; los demás, solo los campos que cambiaron.
function cambios(antes: Valores, despues: Valores) {
  const campos = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])];
  return campos
    .map((campo) => ({ campo, antes: antes?.[campo], despues: despues?.[campo] }))
    .filter((c) => !antes || !despues || JSON.stringify(c.antes) !== JSON.stringify(c.despues));
}

function Registro({ e }: { e: EntradaBitacora }) {
  const entidad = ENTIDADES[e.entidad];
  const accion = ACCIONES_BITACORA.find((a) => a.valor === e.accion)?.etiqueta ?? e.accion;
  const modulo = MODULOS_BITACORA.find((m) => m.valor === e.modulo)?.etiqueta ?? e.modulo;
  const lista = cambios(e.valorAnterior, e.valorNuevo);
  const referencia = e.idEntidad !== null && `${entidad?.nombre ?? e.entidad} #${e.idEntidad}`;

  return (
    <li className={css.registro}>
      <div className={css.lineaRegistro}>
        <time className={`${css.fecha} cifras`} dateTime={e.fecha}>
          {formatoFechaHora(e.fecha)}
        </time>
        <Insignia tono={TONO_ACCION[e.accion] ?? 'neutro'}>{accion}</Insignia>
        <p className={css.frase}>
          <strong>
            {referencia && entidad?.enlace && e.idEntidad !== null ? (
              <Link to={entidad.enlace(e.idEntidad)}>{referencia}</Link>
            ) : (
              referencia || e.entidad
            )}
          </strong>
          <span className={css.secundarioLinea}> · por {e.usuario?.nombre ?? 'el sistema'}</span>
        </p>
        <span className={css.modulo}>{modulo}</span>
      </div>
      {lista.length > 0 && (
        <details className={css.detalle}>
          <summary>
            {lista.length === 1 ? 'Ver el campo afectado' : `Ver los ${lista.length} campos afectados`}
          </summary>
          <div className={css.desborde}>
            <table className={css.cambios}>
              <thead>
                <tr>
                  <th scope="col">Campo</th>
                  {e.valorAnterior && <th scope="col">Antes</th>}
                  {e.valorNuevo && <th scope="col">Después</th>}
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.campo}>
                    <th scope="row">{c.campo}</th>
                    {e.valorAnterior && <td>{valorLegible(c.antes)}</td>}
                    {e.valorNuevo && <td>{valorLegible(c.despues)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </li>
  );
}

export function Bitacora() {
  useTitulo('Bitácora');
  const listado = useListado<EntradaBitacora>({
    clave: 'panel-bitacora',
    ruta: '/admin/bitacora',
    filtros: ['modulo', 'accion', 'entidad', 'idEntidad', 'idUsuario', 'fechaDesde', 'fechaHasta'],
    tamanio: 25,
  });
  const { filtros, datos } = listado;

  // Filtros que llegan desde otras pantallas (por ejemplo, "Actividad" en Usuarios).
  const deOtraPantalla = [
    filtros.idUsuario && {
      texto: `Usuario: ${datos?.find((e) => String(e.usuario?.id) === filtros.idUsuario)?.usuario?.nombre ?? `#${filtros.idUsuario}`}`,
      quitar: { idUsuario: undefined },
    },
    (filtros.entidad || filtros.idEntidad) && {
      texto: `${filtros.entidad ?? 'Registro'}${filtros.idEntidad ? ` #${filtros.idEntidad}` : ''}`,
      quitar: { entidad: undefined, idEntidad: undefined },
    },
  ].filter((f) => !!f);

  let contenido: ReactNode;
  if (!datos) {
    contenido = listado.cargando ? <Cargando /> : <ErrorVista error={listado.error} alReintentar={listado.recargar} />;
  } else if (datos.length === 0) {
    contenido = <Vacio titulo="Sin registros" texto="No hay cambios que coincidan con los filtros." />;
  } else {
    contenido = (
      <ol className={`${css.registros} ${listado.actualizando ? css.actualizando : ''}`}>
        {datos.map((e) => (
          <Registro key={e.id} e={e} />
        ))}
      </ol>
    );
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Bitácora"
        descripcion="Cada cambio del personal en catálogo, inventario, cupones, pedidos y cuentas, con lo que había antes y lo que quedó."
      />

      <BarraFiltros>
        <CampoSeleccion
          etiqueta="Módulo"
          valor={filtros.modulo ?? ''}
          opciones={[{ valor: '', etiqueta: 'Todos' }, ...MODULOS_BITACORA]}
          alCambiar={(modulo) => listado.cambiarFiltros({ modulo })}
        />
        <CampoSeleccion
          etiqueta="Acción"
          valor={filtros.accion ?? ''}
          opciones={[{ valor: '', etiqueta: 'Todas' }, ...ACCIONES_BITACORA]}
          alCambiar={(accion) => listado.cambiarFiltros({ accion })}
        />
        <FiltroFechas
          key={`${filtros.fechaDesde}-${filtros.fechaHasta}`}
          desde={filtros.fechaDesde}
          hasta={filtros.fechaHasta}
          alAplicar={listado.cambiarFiltros}
        />
        {deOtraPantalla.map((f) => (
          <Boton key={f.texto} variante="secundario" chico aria-label={`Quitar el filtro ${f.texto}`} onClick={() => listado.cambiarFiltros(f.quitar)}>
            {f.texto} ✕
          </Boton>
        ))}
      </BarraFiltros>

      {contenido}
      {listado.paginacion && <Paginacion paginacion={listado.paginacion} alCambiar={listado.cambiarPagina} />}
    </>
  );
}
