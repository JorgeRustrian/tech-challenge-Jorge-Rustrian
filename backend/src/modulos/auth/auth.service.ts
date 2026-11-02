import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import * as repositorio from './auth.repository';
import type { Usuario } from './auth.repository';
import type { LoginInput, RegistroInput } from './auth.schemas';
import { firmarAccessToken, generarRefreshToken, hashRefreshToken } from './tokens';

export interface Sesion {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
}

// Si el correo no existe se compara contra este hash igual: el login tarda lo mismo
// y no se puede averiguar qué correos están registrados midiendo tiempos.
const HASH_FICTICIO = bcrypt.hashSync(crypto.randomUUID(), env.BCRYPT_COSTO);

function emitirAccessToken(usuario: Usuario): string {
  return firmarAccessToken({ id: usuario.id, rol: usuario.rol });
}

async function abrirSesion(usuario: Usuario): Promise<Sesion> {
  const refresh = generarRefreshToken();
  await repositorio.crearRefreshToken(usuario.id, refresh.hash, crypto.randomUUID(), env.REFRESH_TOKEN_DIAS);

  return { accessToken: emitirAccessToken(usuario), refreshToken: refresh.token, usuario };
}

export async function registrar(datos: RegistroInput): Promise<Sesion> {
  const passwordHash = await bcrypt.hash(datos.password, env.BCRYPT_COSTO);
  const usuario = await repositorio.registrarCliente({
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    correo: datos.correo,
    passwordHash,
    telefono: datos.telefono,
  });
  return abrirSesion(usuario);
}

export async function iniciarSesion(datos: LoginInput): Promise<Sesion> {
  const credenciales = await repositorio.obtenerCredenciales(datos.correo);
  const coincide = await bcrypt.compare(datos.password, credenciales?.passwordHash ?? HASH_FICTICIO);

  if (!credenciales || !coincide) {
    throw new AppError(401, 'Correo o contrasena incorrectos.');
  }
  if (!credenciales.usuario.activo) {
    throw new AppError(403, 'El usuario esta desactivado.');
  }

  return abrirSesion(credenciales.usuario);
}

export async function refrescarSesion(refreshToken: string | undefined): Promise<Sesion> {
  if (!refreshToken) {
    throw new AppError(401, 'No hay una sesion activa.');
  }

  const nuevo = generarRefreshToken();
  const usuario = await repositorio.rotarRefreshToken(
    hashRefreshToken(refreshToken),
    nuevo.hash,
    env.REFRESH_TOKEN_DIAS,
  );

  return { accessToken: emitirAccessToken(usuario), refreshToken: nuevo.token, usuario };
}

export async function cerrarSesion(refreshToken: string | undefined): Promise<void> {
  if (refreshToken) {
    await repositorio.revocarRefreshToken(hashRefreshToken(refreshToken));
  }
}

export async function obtenerPerfil(idUsuario: number): Promise<Usuario> {
  const usuario = await repositorio.obtenerUsuario(idUsuario);
  if (!usuario) {
    throw new AppError(404, 'Usuario no encontrado.');
  }
  return usuario;
}
