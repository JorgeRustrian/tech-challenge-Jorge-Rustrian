import * as repositorio from './direcciones.repository';
import type { Direccion } from './direcciones.repository';
import type { DireccionActualizarInput, DireccionInput } from './direcciones.schemas';

export function listar(idUsuario: number): Promise<Direccion[]> {
  return repositorio.listar(idUsuario);
}

export function crear(idUsuario: number, datos: DireccionInput): Promise<Direccion> {
  return repositorio.crear(idUsuario, datos);
}

export function actualizar(idUsuario: number, idDireccion: number, datos: DireccionActualizarInput): Promise<Direccion> {
  return repositorio.actualizar(idUsuario, idDireccion, datos);
}

export function marcarPredeterminada(idUsuario: number, idDireccion: number): Promise<Direccion[]> {
  return repositorio.marcarPredeterminada(idUsuario, idDireccion);
}

export function eliminar(idUsuario: number, idDireccion: number): Promise<void> {
  return repositorio.eliminar(idUsuario, idDireccion);
}
