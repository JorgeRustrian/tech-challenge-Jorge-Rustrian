import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import { paginar, type Paginado } from '../../utils/paginacion';
import * as repositorio from './usuarios.repository';
import type { UsuarioAdmin } from './usuarios.repository';
import type { ActualizarUsuarioInput, CrearUsuarioInput, ListarUsuariosQuery } from './usuarios.schemas';

export async function listar(q: ListarUsuariosQuery, idAdmin: number): Promise<Paginado<UsuarioAdmin>> {
  const { total, usuarios } = await repositorio.listar(q, idAdmin);
  return paginar(usuarios, total, q.pagina, q.tamanio);
}

export function obtener(idUsuario: number, idAdmin: number): Promise<UsuarioAdmin> {
  return repositorio.obtener(idUsuario, idAdmin);
}

export async function crear(datos: CrearUsuarioInput, idAdmin: number): Promise<UsuarioAdmin> {
  const { password, ...resto } = datos;
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COSTO);
  return repositorio.crear({ ...resto, passwordHash }, idAdmin);
}

// Las reglas sobre el propio administrador y el último administrador también están en el SP;
// aquí se rechaza antes con un mensaje claro.
export function actualizar(idUsuario: number, datos: ActualizarUsuarioInput, idAdmin: number): Promise<UsuarioAdmin> {
  if (idUsuario === idAdmin && datos.rol !== 'ADMIN') {
    throw new AppError(409, 'No puede quitarse a si mismo el rol de Administrador.');
  }
  return repositorio.actualizar(idUsuario, datos, idAdmin);
}

export function cambiarEstado(idUsuario: number, activo: boolean, idAdmin: number): Promise<UsuarioAdmin> {
  if (idUsuario === idAdmin && !activo) {
    throw new AppError(409, 'No puede desactivarse a si mismo.');
  }
  return repositorio.cambiarEstado(idUsuario, activo, idAdmin);
}

export async function cambiarPassword(idUsuario: number, password: string, idAdmin: number): Promise<void> {
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COSTO);
  await repositorio.cambiarPassword(idUsuario, passwordHash, idAdmin);
}
