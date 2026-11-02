import sql from 'mssql';
import { ejecutarSP } from '../../db/ejecutarSP';
import type { ConsultarBitacoraQuery } from './bitacora.schemas';

interface RegistroFila {
  IDBitacora: number;
  Fecha: Date;
  Modulo: string;
  Entidad: string;
  IDEntidad: number;
  Accion: string;
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
  Correo: string;
  ValorAnterior: string | null;
  ValorNuevo: string | null;
}

export interface RegistroBitacora {
  id: number;
  fecha: Date;
  modulo: string;
  entidad: string;
  idEntidad: number;
  accion: string;
  usuario: { id: number; nombre: string; correo: string };
  valorAnterior: unknown;
  valorNuevo: unknown;
}

// La BD garantiza que son JSON válido (CK_Bitacora_ValorAnterior / ValorNuevo).
function aJson(valor: string | null): unknown {
  return valor === null ? null : JSON.parse(valor);
}

export async function consultar(q: ConsultarBitacoraQuery): Promise<{ total: number; registros: RegistroBitacora[] }> {
  const r = await ejecutarSP<[{ Total: number }, RegistroFila]>('dbo.SP_Bitacora_Consultar', [
    { nombre: 'Modulo', tipo: sql.VarChar(20), valor: q.modulo ?? null },
    { nombre: 'Entidad', tipo: sql.VarChar(50), valor: q.entidad ?? null },
    { nombre: 'IDEntidad', tipo: sql.Int, valor: q.idEntidad ?? null },
    { nombre: 'Accion', tipo: sql.VarChar(15), valor: q.accion ?? null },
    { nombre: 'IDUsuario', tipo: sql.Int, valor: q.idUsuario ?? null },
    { nombre: 'FechaDesde', tipo: sql.Date, valor: q.fechaDesde ?? null },
    { nombre: 'FechaHasta', tipo: sql.Date, valor: q.fechaHasta ?? null },
    { nombre: 'Pagina', tipo: sql.Int, valor: q.pagina },
    { nombre: 'TamanioPagina', tipo: sql.Int, valor: q.tamanio },
  ]);

  return {
    total: r.recordsets[0][0].Total,
    registros: r.recordsets[1].map((f) => ({
      id: f.IDBitacora,
      fecha: f.Fecha,
      modulo: f.Modulo,
      entidad: f.Entidad,
      idEntidad: f.IDEntidad,
      accion: f.Accion,
      usuario: { id: f.IDUsuario, nombre: `${f.Nombres} ${f.Apellidos}`, correo: f.Correo },
      valorAnterior: aJson(f.ValorAnterior),
      valorNuevo: aJson(f.ValorNuevo),
    })),
  };
}
