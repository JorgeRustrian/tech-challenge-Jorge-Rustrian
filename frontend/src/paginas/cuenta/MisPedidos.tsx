import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { numeroPedido, type PedidoResumen } from '../../api/pedidos';
import { Boton, BotonEnlace } from '../../componentes/Boton';
import { EncabezadoPagina } from '../../componentes/EncabezadoPagina';
import { EstadoPedido, etiquetaEstadoPedido } from '../../componentes/Insignia';
import { Paginacion } from '../../componentes/Paginacion';
import { Tabla, type Columna } from '../../componentes/Tabla';
import { useListado } from '../../hooks/useListado';
import { useTitulo } from '../../hooks/useTitulo';
import { formatoFechaHora, formatoMoneda } from '../../utils/formato';
import css from './MisPedidos.module.css';

const ESTADOS = ['PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO', 'DEVUELTO_PARCIAL', 'DEVUELTO'];

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

function Filtros({
  valores,
  alCambiar,
}: {
  valores: Record<string, string>;
  alCambiar: (cambios: Record<string, string | undefined>) => void;
}) {
  const [desde, setDesde] = useState(valores.fechaDesde ?? '');
  const [hasta, setHasta] = useState(valores.fechaHasta ?? '');
  const [error, setError] = useState<string | null>(null);

  function aplicarFechas(e: FormEvent) {
    e.preventDefault();
    if (desde && hasta && desde > hasta) {
      setError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setError(null);
    alCambiar({ fechaDesde: desde || undefined, fechaHasta: hasta || undefined });
  }

  return (
    <form className={css.filtros} onSubmit={aplicarFechas} noValidate>
      <label>
        <span>Estado</span>
        <select value={valores.estado ?? ''} onChange={(e) => alCambiar({ estado: e.target.value || undefined })}>
          <option value="">Todos</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {etiquetaEstadoPedido(e)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Desde</span>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
      </label>
      <label>
        <span>Hasta</span>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </label>
      <Boton type="submit" variante="secundario" chico>
        Filtrar
      </Boton>
      {(valores.estado || valores.fechaDesde || valores.fechaHasta) && (
        <Boton
          variante="fantasma"
          chico
          onClick={() => {
            setDesde('');
            setHasta('');
            alCambiar({ estado: undefined, fechaDesde: undefined, fechaHasta: undefined });
          }}
        >
          Quitar filtros
        </Boton>
      )}
      {error && <p className={css.error}>{error}</p>}
    </form>
  );
}

export function MisPedidos() {
  useTitulo('Mis pedidos');
  const listado = useListado<PedidoResumen>({
    clave: 'mis-pedidos',
    ruta: '/pedidos',
    filtros: ['estado', 'fechaDesde', 'fechaHasta'],
    tamanio: 10,
  });
  const hayFiltros = Object.keys(listado.filtros).length > 0;
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
          <Filtros
            key={`${listado.filtros.fechaDesde}-${listado.filtros.fechaHasta}`}
            valores={listado.filtros}
            alCambiar={listado.cambiarFiltros}
          />
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
