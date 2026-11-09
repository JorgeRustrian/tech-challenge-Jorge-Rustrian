import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  obtenerMasVendidos,
  obtenerResumen,
  obtenerVentasPorCategoria,
  type FiltroReporte,
} from '../../../api/reportes';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { Cargando, ErrorVista, Vacio } from '../../../componentes/Estados';
import { BarraFiltros, FiltroFechas } from '../../../componentes/Filtros';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoMoneda } from '../../../utils/formato';
import { CarritosAbandonados } from './CarritosAbandonados';
import { GraficaVentas } from './GraficaVentas';
import { rangosRapidos, useFiltroReporte } from './rango';
import css from './Dashboard.module.css';

const enteros = new Intl.NumberFormat('es-GT');
const diaMes = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const diaMesAnio = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function textoRango({ fechaDesde, fechaHasta }: FiltroReporte) {
  const desde = new Date(`${fechaDesde}T00:00:00Z`);
  const hasta = new Date(`${fechaHasta}T00:00:00Z`);
  if (fechaDesde === fechaHasta) return diaMesAnio.format(hasta);
  const mismoAnio = fechaDesde.slice(0, 4) === fechaHasta.slice(0, 4);
  return `Del ${(mismoAnio ? diaMes : diaMesAnio).format(desde)} al ${diaMesAnio.format(hasta)}`;
}

function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  if (valor <= 0 || maximo <= 0) return null;
  return <span className={css.barra} style={{ width: `${Math.max(2, (valor / maximo) * 100)}%` }} />;
}

function Resumen({ filtro }: { filtro: FiltroReporte }) {
  const consulta = useQuery({
    queryKey: ['reporte', 'resumen', filtro],
    queryFn: ({ signal }) => obtenerResumen(filtro, signal),
    placeholderData: keepPreviousData,
  });

  if (consulta.isPending) {
    return (
      <div className={css.resumenEstado}>
        <Cargando texto="Cargando indicadores" />
      </div>
    );
  }
  if (consulta.error) return <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;

  const i = consulta.data.indicadores;
  return (
    <dl className={`${css.resumen} ${consulta.isPlaceholderData ? css.actualizando : ''}`}>
      <div className={css.destacado}>
        <dt>Ventas netas</dt>
        <dd className={css.valor}>{formatoMoneda(i.ventasNetas)}</dd>
        <dd className={css.nota}>Sin envío y descontado lo devuelto</dd>
      </div>
      <div>
        <dt>Pedidos</dt>
        <dd className={css.valor}>{enteros.format(i.pedidos)}</dd>
        <dd className={css.nota}>Pagados, sin contar cancelados</dd>
      </div>
      <div>
        <dt>Ticket promedio</dt>
        <dd className={css.valor}>{formatoMoneda(i.ticketPromedio)}</dd>
      </div>
      <div>
        <dt>Unidades vendidas</dt>
        <dd className={css.valor}>{enteros.format(i.unidades)}</dd>
      </div>
      <div>
        <dt>Reembolsado</dt>
        <dd className={css.valor}>{formatoMoneda(i.montoDevuelto)}</dd>
        <dd className={css.nota}>Por devoluciones</dd>
      </div>
      <div>
        <dt>Cancelados</dt>
        <dd className={css.valor}>{enteros.format(i.pedidosCancelados)}</dd>
        <dd className={css.nota}>Pedidos</dd>
      </div>
      <div>
        <dt>Carritos abandonados</dt>
        <dd className={`${css.valor} ${i.carritosAbandonados > 0 ? css.alerta : ''}`}>{enteros.format(i.carritosAbandonados)}</dd>
        <dd className={css.nota}>
          <a href="#carritos">En este momento</a>
        </dd>
      </div>
    </dl>
  );
}

function VentasPorCategoria({ filtro }: { filtro: FiltroReporte }) {
  const consulta = useQuery({
    queryKey: ['reporte', 'categorias', filtro],
    queryFn: ({ signal }) => obtenerVentasPorCategoria(filtro, signal),
    placeholderData: keepPreviousData,
  });
  const categorias = consulta.data?.categorias ?? [];
  const maximo = Math.max(0, ...categorias.map((c) => c.ventas));

  let contenido;
  if (consulta.isPending) contenido = <Cargando />;
  else if (consulta.error) contenido = <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;
  else if (maximo === 0) contenido = <Vacio titulo="Sin ventas en este rango" />;
  else {
    contenido = (
      <div className={css.desborde}>
        <table className={css.tabla}>
          <thead>
            <tr>
              <th scope="col">Categoría</th>
              <th scope="col" className={css.columnaBarra}>
                <span className={css.oculto}>Proporción</span>
              </th>
              <th scope="col" className={css.num}>
                Ventas
              </th>
              <th scope="col" className={css.num}>
                %
              </th>
              <th scope="col" className={css.num}>
                Unid.
              </th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.idCategoria} className={c.ventas === 0 ? css.cero : undefined}>
                <td>{c.categoria}</td>
                <td className={css.columnaBarra}>
                  <Barra valor={c.ventas} maximo={maximo} />
                </td>
                <td className={css.num}>{formatoMoneda(c.ventas)}</td>
                <td className={css.num}>{c.porcentaje.toFixed(1)}</td>
                <td className={css.num}>{c.unidades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className={css.tarjeta}>
      <header className={css.cabeceraTarjeta}>
        <div>
          <h2>Ventas por categoría</h2>
          <p className={css.secundario}>Según la categoría actual de cada producto</p>
        </div>
      </header>
      <div className={consulta.isPlaceholderData ? css.actualizando : undefined}>{contenido}</div>
    </section>
  );
}

function MasVendidos({ filtro }: { filtro: FiltroReporte }) {
  const consulta = useQuery({
    queryKey: ['reporte', 'mas-vendidos', filtro],
    queryFn: ({ signal }) => obtenerMasVendidos(filtro, signal),
    placeholderData: keepPreviousData,
  });
  const productos = consulta.data?.productos ?? [];
  const maximo = Math.max(0, ...productos.map((p) => p.unidades));

  let contenido;
  if (consulta.isPending) contenido = <Cargando />;
  else if (consulta.error) contenido = <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;
  else if (productos.length === 0) contenido = <Vacio titulo="Sin ventas en este rango" />;
  else {
    contenido = (
      <div className={css.desborde}>
        <table className={css.tabla}>
          <thead>
            <tr>
              <th scope="col" className={css.num}>
                #
              </th>
              <th scope="col">Producto</th>
              <th scope="col" className={css.columnaBarra}>
                <span className={css.oculto}>Proporción</span>
              </th>
              <th scope="col" className={css.num}>
                Unid.
              </th>
              <th scope="col" className={css.num}>
                Ventas
              </th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p, i) => (
              <tr key={p.idProducto}>
                <td className={`${css.num} ${css.puesto}`}>{i + 1}</td>
                <td>
                  <span className={css.bloqueTexto}>{p.producto}</span>
                  <span className={css.secundario}>{p.categoria}</span>
                </td>
                <td className={css.columnaBarra}>
                  <Barra valor={p.unidades} maximo={maximo} />
                </td>
                <td className={css.num}>{p.unidades}</td>
                <td className={css.num}>{formatoMoneda(p.ventas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className={css.tarjeta}>
      <header className={css.cabeceraTarjeta}>
        <div>
          <h2>Productos más vendidos</h2>
          <p className={css.secundario}>Los 10 con más unidades, ya descontadas las devoluciones</p>
        </div>
      </header>
      <div className={consulta.isPlaceholderData ? css.actualizando : undefined}>{contenido}</div>
    </section>
  );
}

export function Dashboard() {
  useTitulo('Dashboard');
  const { hoy, filtro, agrupacion, cambiar } = useFiltroReporte();
  const rapidos = rangosRapidos(hoy);
  const elegido = rapidos.find((r) => r.fechaDesde === filtro.fechaDesde && r.fechaHasta === filtro.fechaHasta);

  // Al cambiar el rango se vuelve a la agrupación sugerida para ese tamaño.
  const cambiarRango = (r: { fechaDesde?: string; fechaHasta?: string }) =>
    cambiar({ fechaDesde: r.fechaDesde, fechaHasta: r.fechaHasta, agrupacion: undefined });

  return (
    <>
      <EncabezadoPagina titulo="Dashboard" descripcion={textoRango(filtro)} />

      <BarraFiltros>
        <div className={css.campoSegmentos}>
          <span>Rango</span>
          <div className={css.segmentos} role="group" aria-label="Rango de fechas">
            {rapidos.map((r) => (
              <button key={r.etiqueta} type="button" aria-pressed={r === elegido} onClick={() => cambiarRango(r)}>
                {r.etiqueta}
              </button>
            ))}
          </div>
        </div>
        <FiltroFechas
          key={`${filtro.fechaDesde}-${filtro.fechaHasta}`}
          desde={filtro.fechaDesde}
          hasta={filtro.fechaHasta}
          alAplicar={cambiarRango}
        />
        <label className={css.casilla}>
          <input
            type="checkbox"
            checked={filtro.soloEntregados}
            onChange={(e) => cambiar({ entregados: e.target.checked ? '1' : undefined })}
          />
          Solo pedidos entregados
        </label>
      </BarraFiltros>

      <Resumen filtro={filtro} />

      <div className={css.rejilla}>
        <div className={css.completa}>
          <GraficaVentas filtro={filtro} agrupacion={agrupacion} alCambiarAgrupacion={(a) => cambiar({ agrupacion: a })} />
        </div>
        <VentasPorCategoria filtro={filtro} />
        <MasVendidos filtro={filtro} />
        <div className={css.completa}>
          <CarritosAbandonados />
        </div>
      </div>
    </>
  );
}
