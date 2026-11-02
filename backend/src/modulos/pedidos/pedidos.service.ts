import { AppError } from '../../errors/AppError';
import { paginar, type Paginado } from '../../utils/paginacion';
import * as repositorio from './pedidos.repository';
import type { PedidoDetalle, PedidoResumen } from './pedidos.repository';
import type { DevolucionInput, EstadoPedido, ListarMisPedidosQuery, ListarPedidosQuery } from './pedidos.schemas';

// Mismo contenido que TransicionesEstado (009_Datos_Catalogos.sql). El backend rechaza aquí con un
// mensaje claro; la base de datos vuelve a validar en el SP y en TR_Pedidos_ValidarTransicion.
const TRANSICIONES: Record<EstadoPedido, readonly EstadoPedido[]> = {
  PAGADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['DESPACHADO', 'CANCELADO'],
  DESPACHADO: ['ENTREGADO'],
  ENTREGADO: ['DEVUELTO_PARCIAL', 'DEVUELTO'],
  DEVUELTO_PARCIAL: ['DEVUELTO'],
  CANCELADO: [],
  DEVUELTO: [],
};

const DESPACHADOS: readonly string[] = ['DESPACHADO', 'ENTREGADO', 'DEVUELTO_PARCIAL', 'DEVUELTO'];

function validarTransicion(pedido: PedidoDetalle, nuevo: EstadoPedido): void {
  const actual = pedido.estado.codigo as EstadoPedido;
  if (TRANSICIONES[actual].includes(nuevo)) return;

  if (nuevo === 'CANCELADO' && DESPACHADOS.includes(actual)) {
    throw new AppError(409, 'El pedido ya fue despachado y no se puede cancelar.');
  }
  throw new AppError(409, `No se puede pasar un pedido de ${actual} a ${nuevo}.`);
}

/* ---- Cliente: solo sus propios pedidos ---- */

export async function listarMisPedidos(idUsuario: number, q: ListarMisPedidosQuery): Promise<Paginado<PedidoResumen>> {
  const { total, pedidos } = await repositorio.listar({
    idCliente: idUsuario,
    estado: q.estado,
    fechaDesde: q.fechaDesde,
    fechaHasta: q.fechaHasta,
    pagina: q.pagina,
    tamanio: q.tamanio,
  });
  return paginar(pedidos, total, q.pagina, q.tamanio);
}

// Un pedido de otro cliente responde 404, igual que uno que no existe.
export function obtenerMiPedido(idUsuario: number, idPedido: number): Promise<PedidoDetalle> {
  return repositorio.obtener(idPedido, idUsuario);
}

export async function cancelarMiPedido(idUsuario: number, idPedido: number, motivo: string | null): Promise<PedidoDetalle> {
  validarTransicion(await repositorio.obtener(idPedido, idUsuario), 'CANCELADO');
  return repositorio.cancelarPorCliente(idPedido, idUsuario, motivo);
}

/* ---- Operador y Administrador ---- */

export async function listarPedidos(q: ListarPedidosQuery): Promise<Paginado<PedidoResumen>> {
  const { total, pedidos } = await repositorio.listar({
    idCliente: q.idCliente,
    textoCliente: q.cliente,
    estado: q.estado,
    fechaDesde: q.fechaDesde,
    fechaHasta: q.fechaHasta,
    pagina: q.pagina,
    tamanio: q.tamanio,
  });
  return paginar(pedidos, total, q.pagina, q.tamanio);
}

export function obtenerPedido(idPedido: number): Promise<PedidoDetalle> {
  return repositorio.obtener(idPedido, null);
}

export async function cambiarEstado(
  idPedido: number,
  estado: EstadoPedido,
  comentario: string | null,
  idUsuario: number,
): Promise<PedidoDetalle> {
  validarTransicion(await repositorio.obtener(idPedido, null), estado);
  return repositorio.cambiarEstado(idPedido, estado, comentario, idUsuario);
}

// Se valida aquí para responder con claridad; el SP lo vuelve a validar con el pedido bloqueado.
export async function registrarDevolucion(
  idPedido: number,
  datos: DevolucionInput,
  idUsuario: number,
): Promise<PedidoDetalle> {
  const pedido = await repositorio.obtener(idPedido, null);

  if (pedido.estado.codigo !== 'ENTREGADO' && pedido.estado.codigo !== 'DEVUELTO_PARCIAL') {
    throw new AppError(409, 'Solo se pueden devolver productos de pedidos entregados.');
  }

  for (const item of datos.lineas) {
    const linea = pedido.lineas.find((l) => l.id === item.idPedidoDetalle);
    if (!linea) {
      throw new AppError(400, `La linea ${item.idPedidoDetalle} no pertenece al pedido.`);
    }
    const pendiente = linea.cantidad - linea.cantidadDevuelta;
    if (item.cantidad > pendiente) {
      throw new AppError(409, `De ${linea.sku} solo se pueden devolver ${pendiente} unidades.`);
    }
  }

  return repositorio.registrarDevolucion(idPedido, datos.motivo, datos.lineas, idUsuario);
}
