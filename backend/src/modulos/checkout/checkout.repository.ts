import sql from 'mssql';
import { ejecutarSP, type ParametroSP } from '../../db/ejecutarSP';
import {
  aPedidoDetalle,
  type DevolucionFila,
  type DevolucionLineaFila,
  type PedidoCabeceraFila,
  type PedidoDetalle,
  type PedidoHistorialFila,
  type PedidoLineaFila,
} from '../pedidos/pedidos.repository';

export interface ConfiguracionEnvio {
  costo: number;
  gratisDesde: number;
}

interface CabeceraFila {
  FechaExpiracion: Date;
  SegundosRestantes: number;
  CodigoCupon: string | null;
  MensajeCupon: string | null;
}

interface LineaFila {
  IDVariante: number;
  Producto: string;
  SKU: string;
  Talla: string | null;
  Color: string | null;
  Imagen: string | null;
  PrecioUnitario: number;
  Cantidad: number;
  Subtotal: number;
  Descuento: number;
  Total: number;
}

interface TotalesFila {
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  Total: number;
  IVA: number;
}

export interface ResumenCheckout {
  expiraEn: Date;
  segundosRestantes: number;
  cupon: { codigo: string; valido: boolean; mensaje: string | null } | null;
  lineas: {
    idVariante: number;
    producto: string;
    sku: string;
    talla: string | null;
    color: string | null;
    imagen: string | null;
    precioUnitario: number;
    cantidad: number;
    subtotal: number;
    descuento: number;
    total: number;
  }[];
  montos: { subtotal: number; descuento: number; costoEnvio: number; total: number; ivaIncluido: number };
}

function parametrosEnvio(envio: ConfiguracionEnvio): ParametroSP[] {
  return [
    { nombre: 'CostoEnvio', tipo: sql.Decimal(12, 2), valor: envio.costo },
    { nombre: 'EnvioGratisDesde', tipo: sql.Decimal(12, 2), valor: envio.gratisDesde },
  ];
}

async function ejecutarSPResumen(nombreSP: string, parametros: ParametroSP[]): Promise<ResumenCheckout> {
  const r = await ejecutarSP<[CabeceraFila, LineaFila, TotalesFila]>(nombreSP, parametros);
  const c = r.recordsets[0][0];
  const t = r.recordsets[2][0];

  return {
    expiraEn: c.FechaExpiracion,
    segundosRestantes: c.SegundosRestantes,
    cupon: c.CodigoCupon ? { codigo: c.CodigoCupon, valido: c.MensajeCupon === null, mensaje: c.MensajeCupon } : null,
    lineas: r.recordsets[1].map((l) => ({
      idVariante: l.IDVariante,
      producto: l.Producto,
      sku: l.SKU,
      talla: l.Talla,
      color: l.Color,
      imagen: l.Imagen,
      precioUnitario: l.PrecioUnitario,
      cantidad: l.Cantidad,
      subtotal: l.Subtotal,
      descuento: l.Descuento,
      total: l.Total,
    })),
    montos: { subtotal: t.Subtotal, descuento: t.Descuento, costoEnvio: t.CostoEnvio, total: t.Total, ivaIncluido: t.IVA },
  };
}

export function obtener(idUsuario: number, envio: ConfiguracionEnvio): Promise<ResumenCheckout> {
  return ejecutarSPResumen('dbo.SP_Checkout_Obtener', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    ...parametrosEnvio(envio),
  ]);
}

export function iniciarPago(
  idUsuario: number,
  minutosReserva: number,
  envio: ConfiguracionEnvio,
): Promise<ResumenCheckout> {
  return ejecutarSPResumen('dbo.SP_Checkout_IniciarPago', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'MinutosReserva', tipo: sql.Int, valor: minutosReserva },
    ...parametrosEnvio(envio),
  ]);
}

export async function crearPedido(
  idUsuario: number,
  idDireccion: number,
  claveIdempotencia: string,
  envio: ConfiguracionEnvio,
): Promise<{ repetido: boolean; pedido: PedidoDetalle }> {
  // Primer resultado: Repetido. Después, los cinco de SP_Pedidos_Obtener.
  const r = await ejecutarSP<
    [
      { Repetido: boolean },
      PedidoCabeceraFila,
      PedidoLineaFila,
      PedidoHistorialFila,
      DevolucionFila,
      DevolucionLineaFila,
    ]
  >('dbo.SP_Pedidos_CrearPedido', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'IDDireccion', tipo: sql.Int, valor: idDireccion },
    { nombre: 'ClaveIdempotencia', tipo: sql.UniqueIdentifier, valor: claveIdempotencia },
    ...parametrosEnvio(envio),
  ]);

  return {
    repetido: r.recordsets[0][0].Repetido,
    pedido: aPedidoDetalle([r.recordsets[1], r.recordsets[2], r.recordsets[3], r.recordsets[4], r.recordsets[5]]),
  };
}
