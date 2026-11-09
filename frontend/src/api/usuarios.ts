import { solicitar } from './cliente';
import type { Rol } from './tipos';

export interface UsuarioPanel {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion: string | null;
  ultimaSesion: string | null;
  cantidadPedidos: number;
}

export interface DatosUsuario {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  rol: Rol;
}

const BASE = '/admin/usuarios';

export const crearUsuario = (datos: DatosUsuario & { password: string }) =>
  solicitar<UsuarioPanel>(BASE, { metodo: 'POST', cuerpo: datos });
export const actualizarUsuario = (id: number, datos: DatosUsuario) =>
  solicitar<UsuarioPanel>(`${BASE}/${id}`, { metodo: 'PUT', cuerpo: datos });
export const cambiarEstadoUsuario = (id: number, activo: boolean) =>
  solicitar<UsuarioPanel>(`${BASE}/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } });
export const restablecerPassword = (id: number, password: string) =>
  solicitar<void>(`${BASE}/${id}/password`, { metodo: 'PATCH', cuerpo: { password } });
