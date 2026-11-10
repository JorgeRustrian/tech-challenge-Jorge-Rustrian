import { Link } from 'react-router';
import { numeroPedido, type PedidoResumen } from '../../api/pedidos';
import { Boton, BotonEnlace } from '../../componentes/Boton';
import { EncabezadoPagina } from '../../componentes/EncabezadoPagina';
import { BarraFiltros, CampoSeleccion, FiltroFechas } from '../../componentes/Filtros';
import { EstadoPedido, OPCIONES_ESTADO_PEDIDO } from '../../componentes/Insignia';
import { Paginacion } from '../../componentes/Paginacion';
import { Tabla, type Columna } from '../../componentes/Tabla';
import { useListado } from '../../hooks/useListado';
import { useTitulo } from '../../hooks/useTitulo';
import { formatoFechaHora, formatoMoneda } from '../../utils/formato';
import css from './MisPedidos.module.css';

const COLUMNAS: Columna<PedidoResumen>[] = [
  {
    clave: 'numero',
    titulo: 'Pedido',
    celda: (p) => (
      <Link to={`/cuenta/pedidos/${p.id}`} className="cifras">
        {numeroPedido(p.id)}
      </Link>
    ),
  },
  { clave: 'fecha', titulo: 'Fecha', celda: (p) => formatoFechaHora(p.fechaCreacion) },
  { clave: 'estado', titulo: 'Estado', celda: (p) => <EstadoPedido codigo={p.estado.codigo} /> },
  { clave: 'articulos', titulo: 'Artículos', alinear: 'derecha', celda: (p) => p.cantidadArticulos },
  { clave: 'total', titulo: 'Total', alinear: 'derecha', celda: (p) => formatoMoneda(p.total) },
  {
    clave: 'ver',
    titulo: '',
    alinear: 'derecha',
    celda: (p) => (
      <Link to={`/cuenta/pedidos/${p.id}`} className={css.ver}>
        Ver detalle
      </Link>
    ),
  },
];

export function MisPedidos() {
  useTitulo('Mis pedidos');
  const listado = useListado<PedidoResumen>({
    clave: 'mis-pedidos',
    ruta: '/pedidos',
    filtros: ['estado', 'fechaDesde', 'fechaHasta'],
    tamanio: 10,
  });
  const { filtros } = listado;
  const hayFiltros = Object.keys(filtros).length > 0;
  const sinPedidos = !hayFiltros && listado.paginacion?.total === 0;

  return (
    <>
      <EncabezadoPagina titulo="Mis pedidos" descripcion="Del más reciente al más antiguo." />
      {sinPedidos ? (
        <div className={css.vacio}>
          <p className={css.vacioTitulo}>Todavía no ha hecho pedidos</p>
          <p>Cuando compre algo, aquí podrá seguir su estado.</p>
          <BotonEnlace to="/">Ver el catálogo</BotonEnlace>
        </div>
      ) : (
        <>
          <BarraFiltros>
            <CampoSeleccion
              etiqueta="Estado"
              valor={filtros.estado ?? ''}
              opciones={[{ valor: '', etiqueta: 'Todos' }, ...OPCIONES_ESTADO_PEDIDO]}
              alCambiar={(estado) => listado.cambiarFiltros({ estado })}
            />
            <FiltroFechas
              key={`${filtros.fechaDesde}-${filtros.fechaHasta}`}
              desde={filtros.fechaDesde}
              hasta={filtros.fechaHasta}
              alAplicar={listado.cambiarFiltros}
            />
            {hayFiltros && (
              <Boton
                variante="fantasma"
                chico
                onClick={() => listado.cambiarFiltros({ estado: undefined, fechaDesde: undefined, fechaHasta: undefined })}
              >
                Quitar filtros
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
            vacio={{ titulo: 'No hay pedidos con esos filtros', texto: 'Pruebe con otro estado o con otras fechas.' }}
          />
          {listado.paginacion && <Paginacion paginacion={listado.paginacion} alCambiar={listado.cambiarPagina} />}
        </>
      )}
    </>
  );
}
