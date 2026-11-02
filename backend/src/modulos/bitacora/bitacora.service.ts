import { paginar, type Paginado } from '../../utils/paginacion';
import * as repositorio from './bitacora.repository';
import type { RegistroBitacora } from './bitacora.repository';
import type { ConsultarBitacoraQuery } from './bitacora.schemas';

export async function consultar(q: ConsultarBitacoraQuery): Promise<Paginado<RegistroBitacora>> {
  const { total, registros } = await repositorio.consultar(q);
  return paginar(registros, total, q.pagina, q.tamanio);
}
