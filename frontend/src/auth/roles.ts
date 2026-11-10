import type { Rol } from '../api/tipos';

export const ETIQUETA_ROL: Record<Rol, string> = {
  CLIENTE: 'Cliente',
  OPERADOR: 'Operador',
  ADMIN: 'Administrador',
};

export const PERSONAL: Rol[] = ['OPERADOR', 'ADMIN'];

export function esPersonal(rol: Rol): boolean {
  return PERSONAL.includes(rol);
}

export function inicioSegunRol(rol: Rol): string {
  if (rol === 'ADMIN') return '/panel/dashboard';
  if (rol === 'OPERADOR') return '/panel/pedidos';
  return '/';
}
