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

/* ---- Panel: Operador y Administrador ---- */

// Mismas reglas que la tabla TransicionesEstado. Las devoluciones no van aquí: tienen su propio registro.
export const SIGUIENTES_ESTADOS: Record<string, string[]> = {
  PAGADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['DESPACHADO', 'CANCELADO'],
  DESPACHADO: ['ENTREGADO'],
};

export const ADMITEN_DEVOLUCION = ['ENTREGADO', 'DEVUELTO_PARCIAL'];

export interface LineaDevolucion {
  idPedidoDetalle: number;
  cantidad: number;
}

export const obtenerPedidoPanel = (id: number, senal?: AbortSignal) =>
  solicitar<PedidoDetalle>(`/admin/pedidos/${id}`, { senal });

export const cambiarEstadoPedido = (id: number, estado: string, comentario: string | null) =>
  solicitar<PedidoDetalle>(`/admin/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado, comentario } });

export const registrarDevolucion = (id: number, motivo: string, lineas: LineaDevolucion[]) =>
  solicitar<PedidoDetalle>(`/admin/pedidos/${id}/devoluciones`, { metodo: 'POST', cuerpo: { motivo, lineas } });

const centavos = (n: number) => Math.round(n * 100 + 1e-6) / 100;

// Mismo cálculo que el SP: lo acumulado se redondea una sola vez, así la suma de devoluciones
// parciales de una línea da exactamente su total.
export function reembolsoEstimado(linea: LineaPedido, cantidad: number): number {
  if (cantidad <= 0) return 0;
  const antes = linea.cantidadDevuelta;
  return centavos(centavos((linea.total * (antes + cantidad)) / linea.cantidad) - centavos((linea.total * antes) / linea.cantidad));
}
