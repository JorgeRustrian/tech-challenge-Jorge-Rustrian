export const ROLES = ['CLIENTE', 'OPERADOR', 'ADMIN'] as const;

export type Rol = (typeof ROLES)[number];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}

// Lo que viaja en el access token.
export interface UsuarioAutenticado {
  id: number;
  rol: Rol;
}
