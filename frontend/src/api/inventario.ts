import { solicitar } from './cliente';
import type { Paginado } from './tipos';

export interface Existencias {
  fisica: number;
  reservada: number;
  disponible: number;
}

export interface ExistenciaVariante {
  idVariante: number;
  sku: string;
  idProducto: number;
  producto: string;
  categoria: string;
  talla: string | null;
  color: string | null;
  precio: number;
  existencias: Existencias;
  activo: boolean;
  productoActivo: boolean;
}

export interface Movimiento {
  id: number;
  fecha: string;
  tipo: string;
  cantidad: number;
  existenciaAnterior: number;
  existenciaNueva: number;
  motivo: string | null;
  idPedido: number | null;
  usuario: { id: number; nombre: string };
}

export interface VarianteKardex {
  id: number;
  sku: string;
  producto: string;
  talla: string | null;
  color: string | null;
  existencias: Existencias;
}

export type RespuestaKardex = Paginado<Movimiento> & { variante: VarianteKardex };

export interface Conciliacion {
  variantesRevisadas: number;
  descuadres: {
    idVariante: number;
    sku: string;
    existenciaFisica: number;
    sumaKardex: number;
    existenciaReservada: number;
    reservasActivas: number;
  }[];
}

export const TIPOS_MOVIMIENTO = [
  { valor: 'ENTRADA', etiqueta: 'Entrada' },
  { valor: 'VENTA', etiqueta: 'Venta' },
  { valor: 'AJUSTE', etiqueta: 'Ajuste' },
  { valor: 'DEVOLUCION', etiqueta: 'Devolución' },
  { valor: 'CANCELACION', etiqueta: 'Cancelación' },
];

export const registrarEntrada = (idVariante: number, cantidad: number, motivo: string) =>
  solicitar<{ movimiento: Movimiento; existencias: Existencias }>(`/admin/inventario/variantes/${idVariante}/entradas`, {
    metodo: 'POST',
    cuerpo: { cantidad, motivo },
  });

// Cantidad positiva suma y negativa resta.
export const registrarAjuste = (idVariante: number, cantidad: number, motivo: string) =>
  solicitar<{ movimiento: Movimiento; existencias: Existencias }>(`/admin/inventario/variantes/${idVariante}/ajustes`, {
    metodo: 'POST',
    cuerpo: { cantidad, motivo },
  });

export const conciliarInventario = (senal?: AbortSignal) =>
  solicitar<Conciliacion>('/admin/inventario/conciliacion', { senal });
