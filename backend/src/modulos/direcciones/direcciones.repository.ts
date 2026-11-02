import sql from 'mssql';
import { ejecutarSP, type ParametroSP } from '../../db/ejecutarSP';
import type { DireccionActualizarInput, DireccionInput } from './direcciones.schemas';

interface DireccionFila {
  IDDireccion: number;
  Alias: string;
  NombreDestinatario: string;
  Telefono: string;
  DireccionLinea: string;
  Zona: number | null;
  Municipio: string;
  Departamento: string;
  Referencias: string | null;
  EsPredeterminada: boolean;
}

export interface Direccion {
  id: number;
  alias: string;
  nombreDestinatario: string;
  telefono: string;
  direccionLinea: string;
  zona: number | null;
  municipio: string;
  departamento: string;
  referencias: string | null;
  esPredeterminada: boolean;
}

function aDireccion(f: DireccionFila): Direccion {
  return {
    id: f.IDDireccion,
    alias: f.Alias,
    nombreDestinatario: f.NombreDestinatario,
    telefono: f.Telefono,
    direccionLinea: f.DireccionLinea,
    zona: f.Zona,
    municipio: f.Municipio,
    departamento: f.Departamento,
    referencias: f.Referencias,
    esPredeterminada: f.EsPredeterminada,
  };
}

function parametrosDireccion(d: DireccionActualizarInput): ParametroSP[] {
  return [
    { nombre: 'Alias', tipo: sql.NVarChar(50), valor: d.alias },
    { nombre: 'NombreDestinatario', tipo: sql.NVarChar(150), valor: d.nombreDestinatario },
    { nombre: 'Telefono', tipo: sql.VarChar(20), valor: d.telefono },
    { nombre: 'DireccionLinea', tipo: sql.NVarChar(250), valor: d.direccionLinea },
    { nombre: 'Zona', tipo: sql.TinyInt, valor: d.zona },
    { nombre: 'Municipio', tipo: sql.NVarChar(100), valor: d.municipio },
    { nombre: 'Departamento', tipo: sql.NVarChar(100), valor: d.departamento },
    { nombre: 'Referencias', tipo: sql.NVarChar(250), valor: d.referencias },
  ];
}

// Todas reciben el usuario de la sesión: el SP solo toca direcciones de ese usuario.
export async function listar(idUsuario: number): Promise<Direccion[]> {
  const r = await ejecutarSP<DireccionFila>('dbo.SP_Direcciones_Listar', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
  ]);
  return r.recordset.map(aDireccion);
}

export async function crear(idUsuario: number, datos: DireccionInput): Promise<Direccion> {
  const r = await ejecutarSP<DireccionFila>('dbo.SP_Direcciones_Crear', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    ...parametrosDireccion(datos),
    { nombre: 'EsPredeterminada', tipo: sql.Bit, valor: datos.esPredeterminada },
  ]);
  return aDireccion(r.recordset[0]);
}

export async function actualizar(
  idUsuario: number,
  idDireccion: number,
  datos: DireccionActualizarInput,
): Promise<Direccion> {
  const r = await ejecutarSP<DireccionFila>('dbo.SP_Direcciones_Actualizar', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'IDDireccion', tipo: sql.Int, valor: idDireccion },
    ...parametrosDireccion(datos),
  ]);
  return aDireccion(r.recordset[0]);
}

export async function marcarPredeterminada(idUsuario: number, idDireccion: number): Promise<Direccion[]> {
  const r = await ejecutarSP<DireccionFila>('dbo.SP_Direcciones_MarcarPredeterminada', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'IDDireccion', tipo: sql.Int, valor: idDireccion },
  ]);
  return r.recordset.map(aDireccion);
}

export async function eliminar(idUsuario: number, idDireccion: number): Promise<void> {
  await ejecutarSP('dbo.SP_Direcciones_Eliminar', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'IDDireccion', tipo: sql.Int, valor: idDireccion },
  ]);
}
