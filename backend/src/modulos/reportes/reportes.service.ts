import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import { paginar, type Paginado } from '../../utils/paginacion';
import * as repositorio from './reportes.repository';
import type {
  CarritoAbandonado,
  Rango,
  Resumen,
  ProductoVendido,
  VentaCategoria,
  VentaPeriodo,
} from './reportes.repository';
import type {
  CarritosAbandonadosQuery,
  ProductosMasVendidosQuery,
  RangoReporteQuery,
  VentasPorPeriodoQuery,
} from './reportes.schemas';

const DIAS_POR_DEFECTO = 30;
const DIAS_MAXIMOS = 731;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Fecha de hoy en Guatemala como AAAA-MM-DD (en-CA da ese formato).
function hoyEnGuatemala(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
}

function restarDias(fechaIso: string, dias: number): string {
  return new Date(Date.parse(fechaIso) - dias * MS_POR_DIA).toISOString().slice(0, 10);
}

// Completa el rango que no vino: por defecto, los últimos 30 días hasta hoy.
function resolverRango(q: RangoReporteQuery): Rango {
  const fechaHasta = q.fechaHasta ?? hoyEnGuatemala();
  const fechaDesde = q.fechaDesde ?? restarDias(fechaHasta, DIAS_POR_DEFECTO - 1);

  if (fechaDesde > fechaHasta) {
    throw new AppError(400, 'fechaDesde no puede ser posterior a fechaHasta.');
  }
  if ((Date.parse(fechaHasta) - Date.parse(fechaDesde)) / MS_POR_DIA > DIAS_MAXIMOS) {
    throw new AppError(400, 'El rango no puede ser mayor a dos anios.');
  }

  return { fechaDesde, fechaHasta, soloEntregados: q.soloEntregados };
}

export async function resumen(q: RangoReporteQuery): Promise<Rango & { indicadores: Resumen }> {
  const rango = resolverRango(q);
  return { ...rango, indicadores: await repositorio.resumen(rango, env.CARRITO_ABANDONADO_MINUTOS) };
}

export async function ventasPorPeriodo(
  q: VentasPorPeriodoQuery,
): Promise<Rango & { agrupacion: string; periodos: VentaPeriodo[] }> {
  const rango = resolverRango(q);
  const agrupacion = q.agrupacion.toUpperCase() as 'DIA' | 'SEMANA' | 'MES';
  return { ...rango, agrupacion: q.agrupacion, periodos: await repositorio.ventasPorPeriodo(rango, agrupacion) };
}

export async function ventasPorCategoria(q: RangoReporteQuery): Promise<Rango & { categorias: VentaCategoria[] }> {
  const rango = resolverRango(q);
  return { ...rango, categorias: await repositorio.ventasPorCategoria(rango) };
}

export async function productosMasVendidos(
  q: ProductosMasVendidosQuery,
): Promise<Rango & { productos: ProductoVendido[] }> {
  const rango = resolverRango(q);
  return { ...rango, productos: await repositorio.productosMasVendidos(rango, q.top) };
}

export async function carritosAbandonados(
  q: CarritosAbandonadosQuery,
): Promise<Paginado<CarritoAbandonado> & { minutosInactividad: number; montoTotal: number }> {
  const minutos = q.minutosInactividad ?? env.CARRITO_ABANDONADO_MINUTOS;
  const { total, montoTotal, carritos } = await repositorio.carritosAbandonados(minutos, q.pagina, q.tamanio);
  return { minutosInactividad: minutos, montoTotal, ...paginar(carritos, total, q.pagina, q.tamanio) };
}
