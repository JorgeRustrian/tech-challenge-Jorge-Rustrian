import { fijarAccessToken, solicitar } from './cliente';
import type { Sesion, Usuario } from './tipos';

export interface DatosLogin {
  correo: string;
  password: string;
}

export interface DatosRegistro {
  nombres: string;
  apellidos: string;
  correo: string;
  password: string;
  telefono?: string;
}

export async function iniciarSesion(datos: DatosLogin): Promise<Usuario> {
  const sesion = await solicitar<Sesion>('/auth/login', { metodo: 'POST', cuerpo: datos, sinRenovar: true });
  fijarAccessToken(sesion.accessToken);
  return sesion.usuario;
}

export async function registrarse(datos: DatosRegistro): Promise<Usuario> {
  const sesion = await solicitar<Sesion>('/auth/registro', { metodo: 'POST', cuerpo: datos, sinRenovar: true });
  fijarAccessToken(sesion.accessToken);
  return sesion.usuario;
}

export async function cerrarSesion(): Promise<void> {
  try {
    await solicitar<void>('/auth/logout', { metodo: 'POST', sinRenovar: true });
  } finally {
    fijarAccessToken(null);
  }
}
