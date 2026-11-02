import { env } from '../../config/env';
import type { PedidoDetalle } from '../pedidos/pedidos.repository';
import * as repositorio from './checkout.repository';
import type { ResumenCheckout } from './checkout.repository';

const envio: repositorio.ConfiguracionEnvio = {
  costo: env.COSTO_ENVIO,
  gratisDesde: env.ENVIO_GRATIS_DESDE,
};

export function obtener(idUsuario: number): Promise<ResumenCheckout> {
  return repositorio.obtener(idUsuario, envio);
}

// Reserva la existencia del carrito por RESERVA_MINUTOS y congela precios.
export function iniciarPago(idUsuario: number): Promise<ResumenCheckout> {
  return repositorio.iniciarPago(idUsuario, env.RESERVA_MINUTOS, envio);
}

// repetido = true cuando la clave ya se había usado: se devuelve el mismo pedido, sin crear otro.
export function pagar(
  idUsuario: number,
  idDireccion: number,
  claveIdempotencia: string,
): Promise<{ repetido: boolean; pedido: PedidoDetalle }> {
  return repositorio.crearPedido(idUsuario, idDireccion, claveIdempotencia, envio);
}
