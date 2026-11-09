import { Link } from 'react-router';
import { numeroPedido, type PedidoResumen } from '../../../api/pedidos';
import { Boton } from '../../../componentes/Boton';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { BarraFiltros, CampoBusqueda, FiltroFechas } from '../../../componentes/Filtros';
import { EstadoPedido, OPCIONES_ESTADO_PEDIDO } from '../../../componentes/Insignia';
import { Paginacion } from '../../../componentes/Paginacion';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { useListado } from '../../../hooks/useListado';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoFechaHora, formatoMoneda } from '../../../utils/formato';
import css from './Pedidos.module.css';

const COLUMNAS: Columna<PedidoResumen>[] = [
  {
    clave: 'numero',
    titulo: 'Pedido',
    ancho: '6.5rem',
    celda: (p) => (
      <Link to={`/panel/pedidos/${p.id}`} className={`${css.numero} cifras`}>
        {numeroPedido(p.id)}
      </Link>
    ),
  },
  {
    clave: 'fecha',
    titulo: 'Fecha',
    orden: ['antiguos', 'recientes'],
    celda: (p) => <span className="cifras">{formatoFechaHora(p.fechaCreacion)}</span>,
  },
  {
    clave: 'cliente',
    titulo: 'Cliente',
    celda: (p) => (
      <>
        <span className={css.cliente}>{p.cliente.nombre}</span>
        <span className={css.correo}>{p.cliente.correo}</span>
      </>
    ),
  },
  { clave: 'estado', titulo: 'Estado', celda: (p) => <EstadoPedido codigo={p.estado.codigo} /> },
  { clave: 'articulos', titulo: 'Art.', alinear: 'derecha', celda: (p) => p.cantidadArticulos },
  {
    clave: 'total',
    titulo: 'Total',
    alinear: 'derecha',
    orden: ['total_asc', 'total_desc'],
    celda: (p) => formatoMoneda(p.total),
  },
];

const PESTANAS = [{ valor: '', etiqueta: 'Todos' }, ...OPCIONES_ESTADO_PEDIDO];

export function PedidosPanel() {
  useTitulo('Pedidos');
  const listado = useListado<PedidoResumen>({
    clave: 'panel-pedidos',
    ruta: '/admin/pedidos',
    filtros: ['estado', 'cliente', 'fechaDesde', 'fechaHasta'],
    tamanio: 20,
    ordenInicial: 'recientes',
  });
  const { filtros } = listado;
  const estado = filtros.estado ?? '';

  return (
    <>
      <EncabezadoPagina
        titulo="Pedidos"
        descripcion={
          listado.paginacion && `${listado.paginacion.total} ${listado.paginacion.total === 1 ? 'pedido' : 'pedidos'}`
        }
      />

      <nav className={css.pestanas} aria-label="Filtrar por estado">
        {PESTANAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            aria-pressed={estado === p.valor}
            onClick={() => listado.cambiarFiltros({ estado: p.valor || undefined })}
          >
            {p.etiqueta}
          </button>
        ))}
      </nav>

      <BarraFiltros>
        <CampoBusqueda
          etiqueta="Cliente"
          valor={filtros.cliente ?? ''}
          placeholder="Nombre o correo"
          alCambiar={(cliente) => listado.cambiarFiltros({ cliente })}
        />
        <FiltroFechas
          key={`${filtros.fechaDesde}-${filtros.fechaHasta}`}
          desde={filtros.fechaDesde}
          hasta={filtros.fechaHasta}
          alAplicar={listado.cambiarFiltros}
        />
        {(filtros.fechaDesde || filtros.fechaHasta) && (
          <Boton variante="fantasma" chico onClick={() => listado.cambiarFiltros({ fechaDesde: undefined, fechaHasta: undefined })}>
            Quitar fechas
          </Boton>
        )}
      </BarraFiltros>

      <Tabla
        columnas={COLUMNAS}
        filas={listado.datos}
        claveFila={(p) => p.id}
        cargando={listado.cargando}
        error={listado.error}
        alReintentar={listado.recargar}
        actualizando={listado.actualizando}
        orden={listado.orden}
        alOrdenar={listado.cambiarOrden}
        vacio={{ titulo: 'Sin pedidos', texto: 'No hay pedidos que coincidan con los filtros.' }}
      />
      {listado.paginacion && <Paginacion paginacion={listado.paginacion} alCambiar={listado.cambiarPagina} />}
    </>
  );
}
