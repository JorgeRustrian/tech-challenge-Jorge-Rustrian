import { solicitar } from './cliente';
import type { Paginado } from './tipos';

export type Agrupacion = 'dia' | 'semana' | 'mes';

export interface FiltroReporte {
  fechaDesde: string;
  fechaHasta: string;
  soloEntregados: boolean;
}

export interface Indicadores {
  ventasNetas: number;
  pedidos: number;
  unidades: number;
  ticketPromedio: number;
  montoDevuelto: number;
  pedidosCancelados: number;
  carritosAbandonados: number;
}

export interface VentaPeriodo {
  periodo: string;
  ventas: number;
  pedidos: number;
  unidades: number;
}

export interface VentaCategoria {
  idCategoria: number;
  categoria: string;
  ventas: number;
  unidades: number;
  pedidos: number;
  porcentaje: number;
}

export interface ProductoVendido {
  idProducto: number;
  producto: string;
  categoria: string;
  unidades: number;
  ventas: number;
  pedidos: number;
}

export interface CarritoAbandonado {
  idCarrito: number;
  cliente: { id: number; nombre: string; correo: string } | null;
  ultimaActividad: string;
  minutosInactivo: number;
  articulos: number;
  montoEstimado: number;
}

export interface RespuestaCarritos extends Paginado<CarritoAbandonado> {
  minutosInactividad: number;
  montoTotal: number;
}

const BASE = '/admin/reportes';

export function obtenerResumen(f: FiltroReporte, senal?: AbortSignal) {
  return solicitar<FiltroReporte & { indicadores: Indicadores }>(`${BASE}/resumen`, { parametros: { ...f }, senal });
}

export function obtenerVentas(f: FiltroReporte, agrupacion: Agrupacion, senal?: AbortSignal) {
  return solicitar<FiltroReporte & { periodos: VentaPeriodo[] }>(`${BASE}/ventas`, {
    parametros: { ...f, agrupacion },
    senal,
  });
}

export function obtenerVentasPorCategoria(f: FiltroReporte, senal?: AbortSignal) {
  return solicitar<FiltroReporte & { categorias: VentaCategoria[] }>(`${BASE}/ventas-por-categoria`, {
    parametros: { ...f },
    senal,
  });
}

export function obtenerMasVendidos(f: FiltroReporte, senal?: AbortSignal) {
  return solicitar<FiltroReporte & { productos: ProductoVendido[] }>(`${BASE}/productos-mas-vendidos`, {
    parametros: { ...f, top: 10 },
    senal,
  });
}

export function obtenerCarritosAbandonados(minutos: number | undefined, pagina: number, senal?: AbortSignal) {
  return solicitar<RespuestaCarritos>(`${BASE}/carritos-abandonados`, {
    parametros: { minutosInactividad: minutos, pagina, tamanio: 10 },
    senal,
  });
}
