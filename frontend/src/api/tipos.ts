export type Rol = 'CLIENTE' | 'OPERADOR' | 'ADMIN';

export interface Usuario {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
}

export interface Sesion {
  accessToken: string;
  usuario: Usuario;
}

export interface Paginacion {
  pagina: number;
  tamanio: number;
  total: number;
  totalPaginas: number;
}

export interface Paginado<T> {
  datos: T[];
  paginacion: Paginacion;
}

export interface DetalleError {
  campo: string;
  mensaje: string;
}
