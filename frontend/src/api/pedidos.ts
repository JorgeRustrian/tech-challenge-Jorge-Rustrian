import { solicitar } from './cliente';

export interface EstadoPedido {
  codigo: string;
  nombre: string;
}

export interface PedidoResumen {
  id: number;
  fechaCreacion: string;
  estado: EstadoPedido;
  cliente: { id: number; nombre: string; correo: string };
  cantidadArticulos: number;
  total: number;
}

export interface LineaPedido {
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
}

export interface PedidoDetalle {
  id: number;
  estado: EstadoPedido;
  fechaCreacion: string;
  fechaModificacion: string | null;
  cliente: { id: number; nombre: string; correo: string };
  entrega: { destinatario: string; telefono: string; direccion: string };
  cupon: string | null;
  lineas: LineaPedido[];
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
    fecha: string;
    estadoAnterior: string | null;
    estadoNuevo: string;
    comentario: string | null;
    usuario: { id: number; nombre: string };
  }[];
  devoluciones: {
    id: number;
    fecha: string;
    motivo: string;
    montoReembolso: number;
    usuario: { id: number; nombre: string };
    lineas: { idPedidoDetalle: number; sku: string; cantidad: number; monto: number }[];
  }[];
}

// El cliente puede cancelar mientras el pedido no haya salido de la bodega.
export const CANCELABLES_POR_CLIENTE = ['PAGADO', 'EN_PREPARACION'];

export function numeroPedido(id: number): string {
  return `#${String(id).padStart(5, '0')}`;
}

export const obtenerMiPedido = (id: number, senal?: AbortSignal) =>
  solicitar<PedidoDetalle>(`/pedidos/${id}`, { senal });

export const cancelarMiPedido = (id: number, motivo: string | null) =>
  solicitar<PedidoDetalle>(`/pedidos/${id}/cancelar`, { metodo: 'POST', cuerpo: { motivo } });
