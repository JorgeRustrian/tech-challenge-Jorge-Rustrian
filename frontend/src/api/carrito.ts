import { solicitar, type Opciones } from './cliente';

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

export interface CuponCarrito {
  codigo: string;
  descripcion: string | null;
  tipoDescuento: 'PORCENTAJE' | 'MONTO';
  valor: number;
  valido: boolean;
  mensaje: string | null;
}

export interface Carrito {
  token: string | null;
  items: ItemCarrito[];
  cupon: CuponCarrito | null;
  resumen: {
    cantidadArticulos: number;
    subtotal: number;
    descuento: number;
    total: number;
    ivaIncluido: number;
  };
}

export const CLAVE_CARRITO = ['carrito'];

// El carrito de invitado se identifica con un token que genera la base de datos.
// Va en localStorage para que el carrito sobreviva a cerrar el navegador.
const CLAVE_TOKEN = 'shopcart-carrito';

export function tokenInvitado(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

function guardarToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento (modo privado estricto): el carrito dura lo que dure la pestaña.
  }
}

// Con sesión la API ignora el token y usa el carrito del cliente, así que se puede enviar siempre.
async function pedir(ruta: string, op: Opciones = {}): Promise<Carrito> {
  const token = tokenInvitado();
  const carrito = await solicitar<Carrito>(`/carrito${ruta}`, {
    ...op,
    encabezados: token ? { 'X-Carrito-Token': token } : undefined,
  });
  // Solo el carrito de invitado trae token; si es nuevo (el anterior venció) reemplaza al guardado.
  if (carrito.token) guardarToken(carrito.token);
  return carrito;
}

export const obtenerCarrito = (senal?: AbortSignal) => pedir('', { senal });
export const agregarAlCarrito = (idVariante: number, cantidad: number) =>
  pedir('/items', { metodo: 'POST', cuerpo: { idVariante, cantidad } });
export const cambiarCantidad = (idVariante: number, cantidad: number) =>
  pedir(`/items/${idVariante}`, { metodo: 'PUT', cuerpo: { cantidad } });
export const quitarDelCarrito = (idVariante: number) => pedir(`/items/${idVariante}`, { metodo: 'DELETE' });
export const vaciarCarrito = () => pedir('', { metodo: 'DELETE' });
export const aplicarCupon = (codigo: string) => pedir('/cupon', { metodo: 'POST', cuerpo: { codigo } });
export const quitarCupon = () => pedir('/cupon', { metodo: 'DELETE' });

// Pasa al cliente lo que eligió como invitado. Devuelve null si no había carrito de invitado.
export async function fusionarCarritoInvitado(): Promise<Carrito | null> {
  if (!tokenInvitado()) return null;
  const carrito = await pedir('/fusionar', { metodo: 'POST' });
  guardarToken(null);
  return carrito;
}
