import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { obtenerVentas, type Agrupacion, type FiltroReporte, type VentaPeriodo } from '../../../api/reportes';
import { Cargando, ErrorVista, Vacio } from '../../../componentes/Estados';
import { formatoMoneda } from '../../../utils/formato';
import css from './Dashboard.module.css';

const OPCIONES: { valor: Agrupacion; etiqueta: string }[] = [
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
];

const TITULO: Record<Agrupacion, string> = { dia: 'Ventas por día', semana: 'Ventas por semana', mes: 'Ventas por mes' };

// Los periodos llegan como AAAA-MM-DD; se leen en UTC para que no se corran un día.
const diaCorto = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const diaLargo = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const mesCorto = new Intl.DateTimeFormat('es-GT', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const mesLargo = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const enteros = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 0 });

function fecha(periodo: string) {
  return new Date(`${periodo}T00:00:00Z`);
}

function etiquetaEje(periodo: string, agrupacion: Agrupacion) {
  return agrupacion === 'mes' ? mesCorto.format(fecha(periodo)) : diaCorto.format(fecha(periodo));
}

function etiquetaPeriodo(periodo: string, agrupacion: Agrupacion) {
  if (agrupacion === 'mes') return mesLargo.format(fecha(periodo));
  if (agrupacion === 'semana') return `Semana del ${diaLargo.format(fecha(periodo))}`;
  return diaLargo.format(fecha(periodo));
}

function ejeMoneda(valor: number) {
  if (valor >= 1_000_000) return `Q ${enteros.format(valor / 1_000_000)} M`;
  if (valor >= 10_000) return `Q ${enteros.format(valor / 1000)} mil`;
  return `Q ${enteros.format(valor)}`;
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function Detalle({ p, agrupacion }: { p: VentaPeriodo; agrupacion: Agrupacion }) {
  return (
    <div className={css.globo}>
      <strong>{formatoMoneda(p.ventas)}</strong>
      <span>{etiquetaPeriodo(p.periodo, agrupacion)}</span>
      <span>
        {plural(p.pedidos, 'pedido', 'pedidos')} · {plural(p.unidades, 'unidad', 'unidades')}
      </span>
    </div>
  );
}

export function GraficaVentas({
  filtro,
  agrupacion,
  alCambiarAgrupacion,
}: {
  filtro: FiltroReporte;
  agrupacion: Agrupacion;
  alCambiarAgrupacion: (a: Agrupacion) => void;
}) {
  const [verTabla, setVerTabla] = useState(false);
  const consulta = useQuery({
    queryKey: ['reporte', 'ventas', filtro, agrupacion],
    queryFn: ({ signal }) => obtenerVentas(filtro, agrupacion, signal),
    placeholderData: keepPreviousData,
  });

  const periodos = consulta.data?.periodos ?? [];
  const total = periodos.reduce((suma, p) => suma + p.ventas, 0);
  const mejor = periodos.reduce<VentaPeriodo | null>((m, p) => (p.ventas > (m?.ventas ?? 0) ? p : m), null);
  const nombrePeriodo = { dia: 'día', semana: 'semana', mes: 'mes' }[agrupacion];

  let contenido;
  if (consulta.isPending) contenido = <Cargando texto="Cargando ventas" />;
  else if (consulta.error) contenido = <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;
  else if (total === 0) contenido = <Vacio titulo="Sin ventas en este rango" texto="Pruebe con un rango de fechas más amplio." />;
  else if (verTabla) {
    contenido = (
      <div className={css.desborde}>
        <table className={css.tabla}>
          <thead>
            <tr>
              <th scope="col">Periodo</th>
              <th scope="col" className={css.num}>
                Ventas
              </th>
              <th scope="col" className={css.num}>
                Pedidos
              </th>
              <th scope="col" className={css.num}>
                Unidades
              </th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.periodo} className={p.ventas === 0 ? css.cero : undefined}>
                <td>{etiquetaPeriodo(p.periodo, agrupacion)}</td>
                <td className={css.num}>{formatoMoneda(p.ventas)}</td>
                <td className={css.num}>{p.pedidos}</td>
                <td className={css.num}>{p.unidades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    contenido = (
      <div className={css.grafica} role="img" aria-label={`${TITULO[agrupacion]}: total ${formatoMoneda(total)}`}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={periodos} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--linea)" />
            <XAxis
              dataKey="periodo"
              tickFormatter={(p: string) => etiquetaEje(p, agrupacion)}
              tick={{ fontSize: 12, fill: 'var(--tinta-tenue)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--linea-fuerte)' }}
              minTickGap={20}
            />
            <YAxis
              tickFormatter={ejeMoneda}
              tick={{ fontSize: 12, fill: 'var(--tinta-tenue)' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={72}
            />
            <Tooltip
              cursor={{ fill: 'var(--superficie-hundida)' }}
              isAnimationActive={false}
              content={({ active, payload }) =>
                active && payload?.[0] ? <Detalle p={payload[0].payload as VentaPeriodo} agrupacion={agrupacion} /> : null
              }
            />
            <Bar
              dataKey="ventas"
              fill="var(--marca)"
              activeBar={{ fill: 'var(--marca-oscura)' }}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <section className={css.tarjeta}>
      <header className={css.cabeceraTarjeta}>
        <div>
          <h2>{TITULO[agrupacion]}</h2>
          {total > 0 && mejor && (
            <p className={css.secundario}>
              Total {formatoMoneda(total)} · Mejor {nombrePeriodo}:{' '}
              {agrupacion === 'semana' ? `la del ${diaLargo.format(fecha(mejor.periodo))}` : etiquetaPeriodo(mejor.periodo, agrupacion)},{' '}
              {formatoMoneda(mejor.ventas)}
            </p>
          )}
        </div>
        <div className={css.controles}>
          <div className={css.segmentos} role="group" aria-label="Agrupar por">
            {OPCIONES.map((o) => (
              <button
                key={o.valor}
                type="button"
                aria-pressed={agrupacion === o.valor}
                onClick={() => alCambiarAgrupacion(o.valor)}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>
          {total > 0 && (
            <button type="button" className={css.enlace} onClick={() => setVerTabla(!verTabla)}>
              {verTabla ? 'Ver gráfica' : 'Ver tabla'}
            </button>
          )}
        </div>
      </header>
      <div className={consulta.isPlaceholderData ? css.actualizando : undefined}>{contenido}</div>
    </section>
  );
}
