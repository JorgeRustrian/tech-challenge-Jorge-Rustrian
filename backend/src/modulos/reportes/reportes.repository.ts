import sql from 'mssql';
import { ejecutarSP, type ParametroSP } from '../../db/ejecutarSP';

export interface Rango {
  fechaDesde: string;
  fechaHasta: string;
  soloEntregados: boolean;
}

interface ResumenFila {
  VentasNetas: number;
  Pedidos: number;
  Unidades: number;
  TicketPromedio: number | null;
  MontoDevuelto: number;
  PedidosCancelados: number;
  CarritosAbandonados: number;
}

interface PeriodoFila {
  Periodo: Date;
  Ventas: number;
  Pedidos: number;
  Unidades: number;
}

interface CategoriaFila {
  IDCategoria: number;
  Categoria: string;
  Ventas: number;
  Unidades: number;
  Pedidos: number;
  Porcentaje: number;
}

interface ProductoFila {
  IDProducto: number;
  Producto: string;
  Categoria: string;
  Unidades: number;
  Ventas: number;
  Pedidos: number;
}

interface CarritoFila {
  IDCarrito: number;
  IDUsuario: number | null;
  Nombres: string | null;
  Apellidos: string | null;
  Correo: string | null;
  FechaUltimaActividad: Date;
  MinutosInactivo: number;
  Articulos: number;
  MontoEstimado: number;
}

export interface Resumen {
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
  ultimaActividad: Date;
  minutosInactivo: number;
  articulos: number;
  montoEstimado: number;
}

function parametrosRango(r: Rango): ParametroSP[] {
  return [
    { nombre: 'FechaDesde', tipo: sql.Date, valor: r.fechaDesde },
    { nombre: 'FechaHasta', tipo: sql.Date, valor: r.fechaHasta },
    { nombre: 'SoloEntregados', tipo: sql.Bit, valor: r.soloEntregados },
  ];
}

// Las columnas DATE llegan como Date a medianoche UTC: se devuelven como AAAA-MM-DD.
function aFechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export async function resumen(r: Rango, minutosAbandono: number): Promise<Resumen> {
  const res = await ejecutarSP<ResumenFila>('dbo.SP_Reportes_Resumen', [
    ...parametrosRango(r),
    { nombre: 'MinutosAbandono', tipo: sql.Int, valor: minutosAbandono },
  ]);
  const f = res.recordset[0];
  return {
    ventasNetas: f.VentasNetas,
    pedidos: f.Pedidos,
    unidades: f.Unidades,
    ticketPromedio: f.TicketPromedio ?? 0,
    montoDevuelto: f.MontoDevuelto,
    pedidosCancelados: f.PedidosCancelados,
    carritosAbandonados: f.CarritosAbandonados,
  };
}

export async function ventasPorPeriodo(r: Rango, agrupacion: 'DIA' | 'SEMANA' | 'MES'): Promise<VentaPeriodo[]> {
  const res = await ejecutarSP<PeriodoFila>('dbo.SP_Reportes_VentasPorPeriodo', [
    { nombre: 'FechaDesde', tipo: sql.Date, valor: r.fechaDesde },
    { nombre: 'FechaHasta', tipo: sql.Date, valor: r.fechaHasta },
    { nombre: 'Agrupacion', tipo: sql.VarChar(10), valor: agrupacion },
    { nombre: 'SoloEntregados', tipo: sql.Bit, valor: r.soloEntregados },
  ]);
  return res.recordset.map((f) => ({
    periodo: aFechaIso(f.Periodo),
    ventas: f.Ventas,
    pedidos: f.Pedidos,
    unidades: f.Unidades,
  }));
}

export async function ventasPorCategoria(r: Rango): Promise<VentaCategoria[]> {
  const res = await ejecutarSP<CategoriaFila>('dbo.SP_Reportes_VentasPorCategoria', parametrosRango(r));
  return res.recordset.map((f) => ({
    idCategoria: f.IDCategoria,
    categoria: f.Categoria,
    ventas: f.Ventas,
    unidades: f.Unidades,
    pedidos: f.Pedidos,
    porcentaje: f.Porcentaje,
  }));
}

export async function productosMasVendidos(r: Rango, top: number): Promise<ProductoVendido[]> {
  const res = await ejecutarSP<ProductoFila>('dbo.SP_Reportes_ProductosMasVendidos', [
    { nombre: 'FechaDesde', tipo: sql.Date, valor: r.fechaDesde },
    { nombre: 'FechaHasta', tipo: sql.Date, valor: r.fechaHasta },
    { nombre: 'Top', tipo: sql.Int, valor: top },
    { nombre: 'SoloEntregados', tipo: sql.Bit, valor: r.soloEntregados },
  ]);
  return res.recordset.map((f) => ({
    idProducto: f.IDProducto,
    producto: f.Producto,
    categoria: f.Categoria,
    unidades: f.Unidades,
    ventas: f.Ventas,
    pedidos: f.Pedidos,
  }));
}

export async function carritosAbandonados(
  minutosInactividad: number,
  pagina: number,
  tamanio: number,
): Promise<{ total: number; montoTotal: number; carritos: CarritoAbandonado[] }> {
  const res = await ejecutarSP<[{ Total: number; MontoTotal: number }, CarritoFila]>(
    'dbo.SP_Reportes_CarritosAbandonados',
    [
      { nombre: 'MinutosInactividad', tipo: sql.Int, valor: minutosInactividad },
      { nombre: 'Pagina', tipo: sql.Int, valor: pagina },
      { nombre: 'TamanioPagina', tipo: sql.Int, valor: tamanio },
    ],
  );

  const totales = res.recordsets[0][0];
  return {
    total: totales.Total,
    montoTotal: totales.MontoTotal,
    carritos: res.recordsets[1].map((f) => ({
      idCarrito: f.IDCarrito,
      cliente:
        f.IDUsuario !== null
          ? { id: f.IDUsuario, nombre: `${f.Nombres} ${f.Apellidos}`, correo: f.Correo ?? '' }
          : null,
      ultimaActividad: f.FechaUltimaActividad,
      minutosInactivo: f.MinutosInactivo,
      articulos: f.Articulos,
      montoEstimado: f.MontoEstimado,
    })),
  };
}
