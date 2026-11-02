import sql from 'mssql';
import { ejecutarSP, type ParametroSP } from '../../db/ejecutarSP';

// Quién es el dueño del carrito: el usuario de la sesión o el token del invitado. Nunca un IDCarrito.
export interface DuenioCarrito {
  idUsuario: number | null;
  tokenInvitado: string | null;
}

interface CabeceraFila {
  TokenInvitado: string | null;
  CodigoCupon: string | null;
  DescripcionCupon: string | null;
  TipoDescuento: 'PORCENTAJE' | 'MONTO' | null;
  ValorCupon: number | null;
  MensajeCupon: string | null;
}

interface LineaFila {
  IDVariante: number;
  IDProducto: number;
  Producto: string;
  SKU: string;
  Talla: string | null;
  Color: string | null;
  Imagen: string | null;
  PrecioUnitario: number;
  Cantidad: number;
  ExistenciaDisponible: number;
  Vendible: boolean;
  Subtotal: number;
  Descuento: number;
  Total: number;
}

interface TotalesFila {
  CantidadArticulos: number;
  Subtotal: number;
  Descuento: number;
  Total: number;
  IVA: number;
}

export interface LineaCarrito {
  idVariante: number;
  idProducto: number;
  producto: string;
  sku: string;
  talla: string | null;
  color: string | null;
  imagen: string | null;
  precioUnitario: number;
  cantidad: number;
  existenciaDisponible: number;
  vendible: boolean;
  subtotal: number;
  descuento: number;
  total: number;
}

export interface CarritoDatos {
  tokenInvitado: string | null;
  cupon: {
    codigo: string;
    descripcion: string | null;
    tipoDescuento: 'PORCENTAJE' | 'MONTO';
    valor: number;
    motivoInvalido: string | null;
  } | null;
  lineas: LineaCarrito[];
  totales: { cantidadArticulos: number; subtotal: number; descuento: number; total: number; iva: number };
}

function parametrosDuenio(d: DuenioCarrito): ParametroSP[] {
  return [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: d.idUsuario },
    { nombre: 'TokenInvitado', tipo: sql.UniqueIdentifier, valor: d.tokenInvitado },
  ];
}

// Todos los SPs del carrito terminan devolviendo el resumen: cabecera, líneas y totales.
async function ejecutarSPCarrito(
  nombreSP: string,
  duenio: DuenioCarrito,
  extra: ParametroSP[] = [],
): Promise<CarritoDatos> {
  const r = await ejecutarSP<[CabeceraFila, LineaFila, TotalesFila]>(nombreSP, [...parametrosDuenio(duenio), ...extra]);

  const cabecera = r.recordsets[0][0];
  const totales = r.recordsets[2][0];

  return {
    tokenInvitado: cabecera?.TokenInvitado ?? null,
    cupon:
      cabecera?.CodigoCupon && cabecera.TipoDescuento && cabecera.ValorCupon !== null
        ? {
            codigo: cabecera.CodigoCupon,
            descripcion: cabecera.DescripcionCupon,
            tipoDescuento: cabecera.TipoDescuento,
            valor: cabecera.ValorCupon,
            motivoInvalido: cabecera.MensajeCupon,
          }
        : null,
    lineas: r.recordsets[1].map((l) => ({
      idVariante: l.IDVariante,
      idProducto: l.IDProducto,
      producto: l.Producto,
      sku: l.SKU,
      talla: l.Talla,
      color: l.Color,
      imagen: l.Imagen,
      precioUnitario: l.PrecioUnitario,
      cantidad: l.Cantidad,
      existenciaDisponible: l.ExistenciaDisponible,
      vendible: l.Vendible,
      subtotal: l.Subtotal,
      descuento: l.Descuento,
      total: l.Total,
    })),
    totales: {
      cantidadArticulos: totales.CantidadArticulos,
      subtotal: totales.Subtotal,
      descuento: totales.Descuento,
      total: totales.Total,
      iva: totales.IVA,
    },
  };
}

export function obtener(duenio: DuenioCarrito): Promise<CarritoDatos> {
  return ejecutarSPCarrito('dbo.SP_Carrito_Obtener', duenio);
}

export function agregarItem(duenio: DuenioCarrito, idVariante: number, cantidad: number): Promise<CarritoDatos> {
  return ejecutarSPCarrito('dbo.SP_Carrito_AgregarItem', duenio, [
    { nombre: 'IDVariante', tipo: sql.Int, valor: idVariante },
    { nombre: 'Cantidad', tipo: sql.Int, valor: cantidad },
  ]);
}

export function actualizarItem(duenio: DuenioCarrito, idVariante: number, cantidad: number): Promise<CarritoDatos> {
  return ejecutarSPCarrito('dbo.SP_Carrito_ActualizarItem', duenio, [
    { nombre: 'IDVariante', tipo: sql.Int, valor: idVariante },
    { nombre: 'Cantidad', tipo: sql.Int, valor: cantidad },
  ]);
}

export function eliminarItem(duenio: DuenioCarrito, idVariante: number): Promise<CarritoDatos> {
  return ejecutarSPCarrito('dbo.SP_Carrito_EliminarItem', duenio, [
    { nombre: 'IDVariante', tipo: sql.Int, valor: idVariante },
  ]);
}

export function vaciar(duenio: DuenioCarrito): Promise<CarritoDatos> {
  return ejecutarSPCarrito('dbo.SP_Carrito_Vaciar', duenio);
}

export function aplicarCupon(duenio: DuenioCarrito, codigo: string): Promise<CarritoDatos> {
  return ejecutarSPCarrito('dbo.SP_Carrito_AplicarCupon', duenio, [
    { nombre: 'Codigo', tipo: sql.VarChar(30), valor: codigo },
  ]);
}

export function quitarCupon(duenio: DuenioCarrito): Promise<CarritoDatos> {
  return ejecutarSPCarrito('dbo.SP_Carrito_QuitarCupon', duenio);
}

export function fusionar(idUsuario: number, tokenInvitado: string): Promise<CarritoDatos> {
  return ejecutarSPCarrito('dbo.SP_Carrito_Fusionar', { idUsuario, tokenInvitado });
}
