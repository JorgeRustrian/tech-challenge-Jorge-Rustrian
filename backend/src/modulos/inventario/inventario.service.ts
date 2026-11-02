import { paginar, type Paginado } from '../../utils/paginacion';
import * as repositorio from './inventario.repository';
import type { Conciliacion, Existencias, ExistenciaVariante, KardexVariante, Movimiento } from './inventario.repository';
import type { ExistenciasQuery, KardexQuery, MovimientoInput } from './inventario.schemas';

export async function listarExistencias(q: ExistenciasQuery): Promise<Paginado<ExistenciaVariante>> {
  const { total, existencias } = await repositorio.listarExistencias(q);
  return paginar(existencias, total, q.pagina, q.tamanio);
}

export async function listarKardex(
  idVariante: number,
  q: KardexQuery,
): Promise<Paginado<Movimiento> & { variante: KardexVariante['variante'] }> {
  const { variante, total, movimientos } = await repositorio.listarKardex(idVariante, q);
  return { variante, ...paginar(movimientos, total, q.pagina, q.tamanio) };
}

export function registrarEntrada(
  idVariante: number,
  datos: MovimientoInput,
  idUsuario: number,
): Promise<{ movimiento: Movimiento; existencias: Existencias }> {
  return repositorio.registrarEntrada(idVariante, datos, idUsuario);
}

export function registrarAjuste(
  idVariante: number,
  datos: MovimientoInput,
  idUsuario: number,
): Promise<{ movimiento: Movimiento; existencias: Existencias }> {
  return repositorio.registrarAjuste(idVariante, datos, idUsuario);
}

export function conciliar(): Promise<Conciliacion> {
  return repositorio.conciliar();
}

export function liberarReservasVencidas(): Promise<number> {
  return repositorio.liberarReservasVencidas();
}
