import type { ReactNode } from 'react';
import css from './Insignia.module.css';

export type Tono = 'neutro' | 'marca' | 'info' | 'aviso' | 'exito' | 'peligro' | 'acento';

export function Insignia({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`${css.insignia} ${css[tono]}`}>{children}</span>;
}

const ESTADOS_PEDIDO: Record<string, { etiqueta: string; tono: Tono }> = {
  PAGADO: { etiqueta: 'Pagado', tono: 'info' },
  EN_PREPARACION: { etiqueta: 'En preparación', tono: 'aviso' },
  DESPACHADO: { etiqueta: 'Despachado', tono: 'marca' },
  ENTREGADO: { etiqueta: 'Entregado', tono: 'exito' },
  CANCELADO: { etiqueta: 'Cancelado', tono: 'peligro' },
  DEVUELTO_PARCIAL: { etiqueta: 'Devuelto parcial', tono: 'acento' },
  DEVUELTO: { etiqueta: 'Devuelto', tono: 'neutro' },
};

export const OPCIONES_ESTADO_PEDIDO = Object.entries(ESTADOS_PEDIDO).map(([valor, e]) => ({ valor, etiqueta: e.etiqueta }));

export function etiquetaEstadoPedido(codigo: string): string {
  return ESTADOS_PEDIDO[codigo]?.etiqueta ?? codigo;
}

export function EstadoPedido({ codigo }: { codigo: string }) {
  const estado = ESTADOS_PEDIDO[codigo] ?? { etiqueta: codigo, tono: 'neutro' };
  return <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>;
}
