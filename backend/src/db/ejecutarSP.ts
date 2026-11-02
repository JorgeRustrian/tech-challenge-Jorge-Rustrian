import sql from 'mssql';
import { obtenerPool } from './conexion';

export interface ParametroSP {
  nombre: string;
  tipo: sql.ISqlType | (() => sql.ISqlType);
  valor: unknown;
}

// Único punto del backend que habla con SQL Server. Siempre por SP y con parámetros tipados.
export async function ejecutarSP<T = unknown>(
  nombreSP: string,
  parametros: ParametroSP[] = [],
): Promise<sql.IProcedureResult<T>> {
  const pool = await obtenerPool();
  const request = pool.request();

  for (const p of parametros) {
    request.input(p.nombre, p.tipo, p.valor);
  }

  return request.execute<T>(nombreSP);
}
