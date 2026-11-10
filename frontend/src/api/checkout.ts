import { ErrorApi, solicitar } from './cliente';
import type { PedidoDetalle } from './pedidos';

export interface ResumenCheckout {
  expiraEn: string;
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

export const CLAVE_CHECKOUT = ['checkout'];

// Reserva la existencia del carrito y congela los precios. Si ya había un pago en curso, lo reinicia.
export const iniciarPago = () => solicitar<ResumenCheckout>('/checkout/iniciar', { metodo: 'POST' });

// Al volver a la página (o recargarla) se retoma la reserva vigente en lugar de empezar otra.
export async function retomarOIniciarPago(senal?: AbortSignal): Promise<ResumenCheckout> {
  try {
    return await solicitar<ResumenCheckout>('/checkout', { senal });
  } catch (err) {
    if (err instanceof ErrorApi && err.status === 404) return iniciarPago();
    throw err;
  }
}

// La misma clave en cada reintento: si la primera respuesta se perdió, la API devuelve
// el pedido que ya creó en lugar de cobrar otra vez.
export const pagar = (idDireccion: number, claveIdempotencia: string) =>
  solicitar<PedidoDetalle>('/checkout/pagar', {
    metodo: 'POST',
    cuerpo: { idDireccion },
    encabezados: { 'Idempotency-Key': claveIdempotencia },
  });
