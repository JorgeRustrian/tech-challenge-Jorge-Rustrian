import sql from 'mssql';
import { ejecutarSP } from '../../db/ejecutarSP';
import type { ExistenciasQuery, KardexQuery, MovimientoInput } from './inventario.schemas';

/* ---- Filas ---- */

interface ExistenciaFila {
  IDVariante: number;
  SKU: string;
  IDProducto: number;
  Producto: string;
  Categoria: string;
  Talla: string | null;
  Color: string | null;
  Precio: number;
  ExistenciaFisica: number;
  ExistenciaReservada: number;
  ExistenciaDisponible: number;
  Activo: boolean;
  ProductoActivo: boolean;
}

interface MovimientoFila {
  IDKardex: number;
  Fecha: Date;
  TipoMovimiento: string;
  Cantidad: number;
  ExistenciaAnterior: number;
  ExistenciaNueva: number;
  Motivo: string | null;
  IDPedido: number | null;
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
}

interface MovimientoConSaldoFila extends MovimientoFila {
  IDVariante: number;
  SKU: string;
  ExistenciaFisica: number;
  ExistenciaReservada: number;
  ExistenciaDisponible: number;
}

interface VarianteKardexFila {
  IDVariante: number;
  SKU: string;
  Producto: string;
  Talla: string | null;
  Color: string | null;
  ExistenciaFisica: number;
  ExistenciaReservada: number;
  ExistenciaDisponible: number;
}

interface DescuadreFila {
  IDVariante: number;
  SKU: string;
  ExistenciaFisica: number;
  SumaKardex: number;
  ExistenciaReservada: number;
  ReservasActivas: number;
}

/* ---- Modelos ---- */

export interface Existencias {
  fisica: number;
  reservada: number;
  disponible: number;
}

export interface ExistenciaVariante {
  idVariante: number;
  sku: string;
  idProducto: number;
  producto: string;
  categoria: string;
  talla: string | null;
  color: string | null;
  precio: number;
  existencias: Existencias;
  activo: boolean;
  productoActivo: boolean;
}

export interface Movimiento {
  id: number;
  fecha: Date;
  tipo: string;
  cantidad: number;
  existenciaAnterior: number;
  existenciaNueva: number;
  motivo: string | null;
  idPedido: number | null;
  usuario: { id: number; nombre: string };
}

export interface KardexVariante {
  variante: {
    id: number;
    sku: string;
    producto: string;
    talla: string | null;
    color: string | null;
    existencias: Existencias;
  };
  total: number;
  movimientos: Movimiento[];
}

export interface Conciliacion {
  variantesRevisadas: number;
  descuadres: {
    idVariante: number;
    sku: string;
    existenciaFisica: number;
    sumaKardex: number;
    existenciaReservada: number;
    reservasActivas: number;
  }[];
}

function aMovimiento(f: MovimientoFila): Movimiento {
  return {
    id: f.IDKardex,
    fecha: f.Fecha,
    tipo: f.TipoMovimiento,
    cantidad: f.Cantidad,
    existenciaAnterior: f.ExistenciaAnterior,
    existenciaNueva: f.ExistenciaNueva,
    motivo: f.Motivo,
    idPedido: f.IDPedido,
    usuario: { id: f.IDUsuario, nombre: `${f.Nombres} ${f.Apellidos}` },
  };
}

function aExistencias(f: { ExistenciaFisica: number; ExistenciaReservada: number; ExistenciaDisponible: number }) {
  return { fisica: f.ExistenciaFisica, reservada: f.ExistenciaReservada, disponible: f.ExistenciaDisponible };
}

/* ---- Consultas ---- */

export async function listarExistencias(
  q: ExistenciasQuery,
): Promise<{ total: number; existencias: ExistenciaVariante[] }> {
  const r = await ejecutarSP<[{ Total: number }, ExistenciaFila]>('dbo.SP_Inventario_ListarExistencias', [
    { nombre: 'Texto', tipo: sql.NVarChar(100), valor: q.texto ?? null },
    { nombre: 'IDCategoria', tipo: sql.Int, valor: q.idCategoria ?? null },
    { nombre: 'ExistenciaMaxima', tipo: sql.Int, valor: q.existenciaMaxima ?? null },
    { nombre: 'Activo', tipo: sql.Bit, valor: q.activo ?? null },
    { nombre: 'Orden', tipo: sql.VarChar(20), valor: q.orden },
    { nombre: 'Pagina', tipo: sql.Int, valor: q.pagina },
    { nombre: 'TamanioPagina', tipo: sql.Int, valor: q.tamanio },
  ]);

  return {
    total: r.recordsets[0][0].Total,
    existencias: r.recordsets[1].map((f) => ({
      idVariante: f.IDVariante,
      sku: f.SKU,
      idProducto: f.IDProducto,
      producto: f.Producto,
      categoria: f.Categoria,
      talla: f.Talla,
      color: f.Color,
      precio: f.Precio,
      existencias: aExistencias(f),
      activo: f.Activo,
      productoActivo: f.ProductoActivo,
    })),
  };
}

export async function listarKardex(idVariante: number, q: KardexQuery): Promise<KardexVariante> {
  const r = await ejecutarSP<[VarianteKardexFila, { Total: number }, MovimientoFila]>(
    'dbo.SP_Inventario_ListarKardex',
    [
      { nombre: 'IDVariante', tipo: sql.Int, valor: idVariante },
      { nombre: 'TipoMovimiento', tipo: sql.VarChar(15), valor: q.tipo ?? null },
      { nombre: 'FechaDesde', tipo: sql.Date, valor: q.fechaDesde ?? null },
      { nombre: 'FechaHasta', tipo: sql.Date, valor: q.fechaHasta ?? null },
      { nombre: 'Pagina', tipo: sql.Int, valor: q.pagina },
      { nombre: 'TamanioPagina', tipo: sql.Int, valor: q.tamanio },
    ],
  );

  const v = r.recordsets[0][0];
  return {
    variante: {
      id: v.IDVariante,
      sku: v.SKU,
      producto: v.Producto,
      talla: v.Talla,
      color: v.Color,
      existencias: aExistencias(v),
    },
    total: r.recordsets[1][0].Total,
    movimientos: r.recordsets[2].map(aMovimiento),
  };
}

export async function conciliar(): Promise<Conciliacion> {
  const r = await ejecutarSP<[{ VariantesRevisadas: number }, DescuadreFila]>('dbo.SP_Inventario_Conciliar');
  return {
    variantesRevisadas: r.recordsets[0][0].VariantesRevisadas,
    descuadres: r.recordsets[1].map((f) => ({
      idVariante: f.IDVariante,
      sku: f.SKU,
      existenciaFisica: f.ExistenciaFisica,
      sumaKardex: f.SumaKardex,
      existenciaReservada: f.ExistenciaReservada,
      reservasActivas: f.ReservasActivas,
    })),
  };
}

/* ---- Movimientos manuales ---- */

async function registrar(
  nombreSP: string,
  idVariante: number,
  datos: MovimientoInput,
  idUsuario: number,
): Promise<{ movimiento: Movimiento; existencias: Existencias }> {
  const r = await ejecutarSP<MovimientoConSaldoFila>(nombreSP, [
    { nombre: 'IDVariante', tipo: sql.Int, valor: idVariante },
    { nombre: 'Cantidad', tipo: sql.Int, valor: datos.cantidad },
    { nombre: 'Motivo', tipo: sql.NVarChar(250), valor: datos.motivo },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  const f = r.recordset[0];
  return { movimiento: aMovimiento(f), existencias: aExistencias(f) };
}

export function registrarEntrada(idVariante: number, datos: MovimientoInput, idUsuario: number) {
  return registrar('dbo.SP_Inventario_RegistrarEntrada', idVariante, datos, idUsuario);
}

export function registrarAjuste(idVariante: number, datos: MovimientoInput, idUsuario: number) {
  return registrar('dbo.SP_Inventario_RegistrarAjuste', idVariante, datos, idUsuario);
}

/* ---- Reservas ---- */

export async function liberarReservasVencidas(): Promise<number> {
  const r = await ejecutarSP<{ ReservasLiberadas: number }>('dbo.SP_Inventario_LiberarReservasVencidas');
  return r.recordset[0].ReservasLiberadas;
}
