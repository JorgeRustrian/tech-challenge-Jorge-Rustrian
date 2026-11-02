import * as repositorio from './carrito.repository';
import type { CarritoDatos, DuenioCarrito, LineaCarrito } from './carrito.repository';

export interface ItemCarrito {
  idVariante: number;
  idProducto: number;
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
  existenciaDisponible: number;
  disponible: boolean;
  aviso: string | null;
}

export interface Carrito {
  // Solo para invitados: el cliente lo guarda y lo manda en X-Carrito-Token.
  token: string | null;
  items: ItemCarrito[];
  cupon: {
    codigo: string;
    descripcion: string | null;
    tipoDescuento: 'PORCENTAJE' | 'MONTO';
    valor: number;
    valido: boolean;
    mensaje: string | null;
  } | null;
  resumen: {
    cantidadArticulos: number;
    subtotal: number;
    descuento: number;
    total: number;
    ivaIncluido: number;
  };
}

// La existencia pudo cambiar desde que el producto se agregó: el carrito avisa y el checkout lo bloquea.
function avisoDe(l: LineaCarrito): string | null {
  if (!l.vendible) return 'Este producto ya no esta disponible.';
  if (l.existenciaDisponible <= 0) return 'Producto agotado.';
  if (l.cantidad > l.existenciaDisponible) return `Solo hay ${l.existenciaDisponible} unidades disponibles.`;
  return null;
}

function aCarrito(d: CarritoDatos): Carrito {
  return {
    token: d.tokenInvitado,
    items: d.lineas.map((l) => {
      const aviso = avisoDe(l);
      return {
        idVariante: l.idVariante,
        idProducto: l.idProducto,
        producto: l.producto,
        sku: l.sku,
        talla: l.talla,
        color: l.color,
        imagen: l.imagen,
        precioUnitario: l.precioUnitario,
        cantidad: l.cantidad,
        subtotal: l.subtotal,
        descuento: l.descuento,
        total: l.total,
        existenciaDisponible: l.existenciaDisponible,
        disponible: aviso === null,
        aviso,
      };
    }),
    cupon: d.cupon
      ? {
          codigo: d.cupon.codigo,
          descripcion: d.cupon.descripcion,
          tipoDescuento: d.cupon.tipoDescuento,
          valor: d.cupon.valor,
          valido: d.cupon.motivoInvalido === null,
          mensaje: d.cupon.motivoInvalido,
        }
      : null,
    resumen: {
      cantidadArticulos: d.totales.cantidadArticulos,
      subtotal: d.totales.subtotal,
      descuento: d.totales.descuento,
      total: d.totales.total,
      ivaIncluido: d.totales.iva,
    },
  };
}

export async function obtener(duenio: DuenioCarrito): Promise<Carrito> {
  return aCarrito(await repositorio.obtener(duenio));
}

export async function agregarItem(duenio: DuenioCarrito, idVariante: number, cantidad: number): Promise<Carrito> {
  return aCarrito(await repositorio.agregarItem(duenio, idVariante, cantidad));
}

export async function actualizarItem(duenio: DuenioCarrito, idVariante: number, cantidad: number): Promise<Carrito> {
  return aCarrito(await repositorio.actualizarItem(duenio, idVariante, cantidad));
}

export async function eliminarItem(duenio: DuenioCarrito, idVariante: number): Promise<Carrito> {
  return aCarrito(await repositorio.eliminarItem(duenio, idVariante));
}

export async function vaciar(duenio: DuenioCarrito): Promise<Carrito> {
  return aCarrito(await repositorio.vaciar(duenio));
}

export async function aplicarCupon(duenio: DuenioCarrito, codigo: string): Promise<Carrito> {
  return aCarrito(await repositorio.aplicarCupon(duenio, codigo));
}

export async function quitarCupon(duenio: DuenioCarrito): Promise<Carrito> {
  return aCarrito(await repositorio.quitarCupon(duenio));
}

export async function fusionar(idUsuario: number, tokenInvitado: string): Promise<Carrito> {
  return aCarrito(await repositorio.fusionar(idUsuario, tokenInvitado));
}
