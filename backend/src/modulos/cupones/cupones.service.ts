import { paginar, type Paginado } from '../../utils/paginacion';
import * as repositorio from './cupones.repository';
import type { Cupon } from './cupones.repository';
import type { CuponInput, ListarCuponesQuery } from './cupones.schemas';

export async function listar(q: ListarCuponesQuery): Promise<Paginado<Cupon>> {
  const { total, cupones } = await repositorio.listar(q);
  return paginar(cupones, total, q.pagina, q.tamanio);
}

export function obtener(id: number): Promise<Cupon> {
  return repositorio.obtener(id);
}

export function crear(datos: CuponInput, idUsuario: number): Promise<Cupon> {
  return repositorio.crear(datos, idUsuario);
}

export function actualizar(id: number, datos: CuponInput, idUsuario: number): Promise<Cupon> {
  return repositorio.actualizar(id, datos, idUsuario);
}

export function cambiarEstado(id: number, activo: boolean, idUsuario: number): Promise<Cupon> {
  return repositorio.cambiarEstado(id, activo, idUsuario);
}

export function eliminar(id: number, idUsuario: number): Promise<void> {
  return repositorio.eliminar(id, idUsuario);
}
