import sql from 'mssql';
import { ejecutarSP } from '../../db/ejecutarSP';

/* ---- Filas de SP_Pedidos_Obtener (cinco resultados) ---- */

export interface PedidoCabeceraFila {
  IDPedido: number;
  Estado: string;
  EstadoNombre: string;
  FechaCreacion: Date;
  FechaModificacion: Date | null;
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
  Correo: string;
  NombreDestinatario: string;
  TelefonoDestinatario: string;
  DireccionEntrega: string;
  CodigoCupon: string | null;
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  Total: number;
  IVA: number;
  ReferenciaPago: string | null;
}

export interface PedidoLineaFila {
  IDPedidoDetalle: number;
  IDVariante: number;
  SKU: string;
  NombreProducto: string;
  Talla: string | null;
  Color: string | null;
  PrecioUnitario: number;
  Cantidad: number;
  Descuento: number;
  Total: number;
  CantidadDevuelta: number;
}

export interface PedidoHistorialFila {
  Fecha: Date;
  EstadoAnterior: string | null;
  EstadoNuevo: string;
  Comentario: string | null;
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
}

export interface DevolucionFila {
  IDDevolucion: number;
  Fecha: Date;
  Motivo: string;
  MontoReembolso: number;
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
}

export interface DevolucionLineaFila {
  IDDevolucion: number;
  IDPedidoDetalle: number;
  SKU: string;
  Cantidad: number;
  Monto: number;
}

// Tipos de fila de cada resultado (para ejecutarSP) y los resultados ya como arreglos (para el mapeo).
export type ResultadosPedido = [PedidoCabeceraFila, PedidoLineaFila, PedidoHistorialFila, DevolucionFila, DevolucionLineaFila];

export type RecordsetsPedido = [
  PedidoCabeceraFila[],
  PedidoLineaFila[],
  PedidoHistorialFila[],
  DevolucionFila[],
  DevolucionLineaFila[],
];

interface PedidoResumenFila {
  IDPedido: number;
  FechaCreacion: Date;
  Estado: string;
  EstadoNombre: string;
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
  Correo: string;
  Total: number;
  CantidadArticulos: number;
}

/* ---- Modelos ---- */

export interface PedidoDetalle {
  id: number;
  estado: { codigo: string; nombre: string };
  fechaCreacion: Date;
  fechaModificacion: Date | null;
  cliente: { id: number; nombre: string; correo: string };
  entrega: { destinatario: string; telefono: string; direccion: string };
  cupon: string | null;
  lineas: {
    id: number;
    idVariante: number;
    sku: string;
    producto: string;
    talla: string | null;
    color: string | null;
    precioUnitario: number;
    cantidad: number;
    descuento: number;
    total: number;
    cantidadDevuelta: number;
  }[];
  montos: {
    subtotal: number;
    descuento: number;
    costoEnvio: number;
    total: number;
    ivaIncluido: number;
    reembolsado: number;
  };
  referenciaPago: string | null;
  historial: {
    fecha: Date;
    estadoAnterior: string | null;
    estadoNuevo: string;
    comentario: string | null;
    usuario: { id: number; nombre: string };
  }[];
  devoluciones: {
    id: number;
    fecha: Date;
    motivo: string;
    montoReembolso: number;
    usuario: { id: number; nombre: string };
    lineas: { idPedidoDetalle: number; sku: string; cantidad: number; monto: number }[];
  }[];
}

export interface PedidoResumen {
  id: number;
  fechaCreacion: Date;
  estado: { codigo: string; nombre: string };
  cliente: { id: number; nombre: string; correo: string };
  cantidadArticulos: number;
  total: number;
}

export interface FiltrosPedidos {
  idCliente?: number;
  textoCliente?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina: number;
  tamanio: number;
}

// Recibe los cinco resultados de SP_Pedidos_Obtener. Lo usan también checkout y devoluciones.
export function aPedidoDetalle([cabeceras, lineas, historial, devoluciones, lineasDevueltas]: RecordsetsPedido): PedidoDetalle {
  const c = cabeceras[0];

  return {
    id: c.IDPedido,
    estado: { codigo: c.Estado, nombre: c.EstadoNombre },
    fechaCreacion: c.FechaCreacion,
    fechaModificacion: c.FechaModificacion,
    cliente: { id: c.IDUsuario, nombre: `${c.Nombres} ${c.Apellidos}`, correo: c.Correo },
    entrega: { destinatario: c.NombreDestinatario, telefono: c.TelefonoDestinatario, direccion: c.DireccionEntrega },
    cupon: c.CodigoCupon,
    lineas: lineas.map((l) => ({
      id: l.IDPedidoDetalle,
      idVariante: l.IDVariante,
      sku: l.SKU,
      producto: l.NombreProducto,
      talla: l.Talla,
      color: l.Color,
      precioUnitario: l.PrecioUnitario,
      cantidad: l.Cantidad,
      descuento: l.Descuento,
      total: l.Total,
      cantidadDevuelta: l.CantidadDevuelta,
    })),
    montos: {
      subtotal: c.Subtotal,
      descuento: c.Descuento,
      costoEnvio: c.CostoEnvio,
      total: c.Total,
      ivaIncluido: c.IVA,
      // Suma en centavos para no arrastrar errores de punto flotante.
      reembolsado: devoluciones.reduce((s, d) => s + Math.round(d.MontoReembolso * 100), 0) / 100,
    },
    referenciaPago: c.ReferenciaPago,
    historial: historial.map((h) => ({
      fecha: h.Fecha,
      estadoAnterior: h.EstadoAnterior,
      estadoNuevo: h.EstadoNuevo,
      comentario: h.Comentario,
      usuario: { id: h.IDUsuario, nombre: `${h.Nombres} ${h.Apellidos}` },
    })),
    devoluciones: devoluciones.map((d) => ({
      id: d.IDDevolucion,
      fecha: d.Fecha,
      motivo: d.Motivo,
      montoReembolso: d.MontoReembolso,
      usuario: { id: d.IDUsuario, nombre: `${d.Nombres} ${d.Apellidos}` },
      lineas: lineasDevueltas
        .filter((l) => l.IDDevolucion === d.IDDevolucion)
        .map((l) => ({ idPedidoDetalle: l.IDPedidoDetalle, sku: l.SKU, cantidad: l.Cantidad, monto: l.Monto })),
    })),
  };
}

// idUsuario: el del cliente cuando consulta sus propios pedidos; null para Operador y Administrador.
export async function obtener(idPedido: number, idUsuario: number | null): Promise<PedidoDetalle> {
  const r = await ejecutarSP<ResultadosPedido>('dbo.SP_Pedidos_Obtener', [
    { nombre: 'IDPedido', tipo: sql.Int, valor: idPedido },
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
  ]);
  return aPedidoDetalle([r.recordsets[0], r.recordsets[1], r.recordsets[2], r.recordsets[3], r.recordsets[4]]);
}

export async function listar(f: FiltrosPedidos): Promise<{ total: number; pedidos: PedidoResumen[] }> {
  const r = await ejecutarSP<[{ Total: number }, PedidoResumenFila]>('dbo.SP_Pedidos_Listar', [
    { nombre: 'IDCliente', tipo: sql.Int, valor: f.idCliente ?? null },
    { nombre: 'TextoCliente', tipo: sql.NVarChar(100), valor: f.textoCliente ?? null },
    { nombre: 'Estado', tipo: sql.VarChar(20), valor: f.estado ?? null },
    { nombre: 'FechaDesde', tipo: sql.Date, valor: f.fechaDesde ?? null },
    { nombre: 'FechaHasta', tipo: sql.Date, valor: f.fechaHasta ?? null },
    { nombre: 'Pagina', tipo: sql.Int, valor: f.pagina },
    { nombre: 'TamanioPagina', tipo: sql.Int, valor: f.tamanio },
  ]);

  return {
    total: r.recordsets[0][0].Total,
    pedidos: r.recordsets[1].map((p) => ({
      id: p.IDPedido,
      fechaCreacion: p.FechaCreacion,
      estado: { codigo: p.Estado, nombre: p.EstadoNombre },
      cliente: { id: p.IDUsuario, nombre: `${p.Nombres} ${p.Apellidos}`, correo: p.Correo },
      cantidadArticulos: p.CantidadArticulos,
      total: p.Total,
    })),
  };
}

export async function cambiarEstado(
  idPedido: number,
  estado: string,
  comentario: string | null,
  idUsuario: number,
): Promise<PedidoDetalle> {
  const r = await ejecutarSP<ResultadosPedido>('dbo.SP_Pedidos_CambiarEstado', [
    { nombre: 'IDPedido', tipo: sql.Int, valor: idPedido },
    { nombre: 'EstadoNuevo', tipo: sql.VarChar(20), valor: estado },
    { nombre: 'Comentario', tipo: sql.NVarChar(250), valor: comentario },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aPedidoDetalle([r.recordsets[0], r.recordsets[1], r.recordsets[2], r.recordsets[3], r.recordsets[4]]);
}

export async function cancelarPorCliente(
  idPedido: number,
  idUsuario: number,
  motivo: string | null,
): Promise<PedidoDetalle> {
  const r = await ejecutarSP<ResultadosPedido>('dbo.SP_Pedidos_CancelarPorCliente', [
    { nombre: 'IDPedido', tipo: sql.Int, valor: idPedido },
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'Motivo', tipo: sql.NVarChar(200), valor: motivo },
  ]);
  return aPedidoDetalle([r.recordsets[0], r.recordsets[1], r.recordsets[2], r.recordsets[3], r.recordsets[4]]);
}

export async function registrarDevolucion(
  idPedido: number,
  motivo: string,
  lineas: { idPedidoDetalle: number; cantidad: number }[],
  idUsuario: number,
): Promise<PedidoDetalle> {
  const r = await ejecutarSP<ResultadosPedido>('dbo.SP_Pedidos_RegistrarDevolucion', [
    { nombre: 'IDPedido', tipo: sql.Int, valor: idPedido },
    { nombre: 'Motivo', tipo: sql.NVarChar(250), valor: motivo },
    { nombre: 'Lineas', tipo: sql.NVarChar(sql.MAX), valor: JSON.stringify(lineas) },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aPedidoDetalle([r.recordsets[0], r.recordsets[1], r.recordsets[2], r.recordsets[3], r.recordsets[4]]);
}
