import sql from 'mssql';
import { ejecutarSP } from '../../db/ejecutarSP';
import type { Rol } from '../../tipos/auth';

export interface Usuario {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
}

interface UsuarioFila {
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
  Correo: string;
  Telefono: string | null;
  Rol: Rol;
  Activo: boolean;
}

interface CredencialesFila extends UsuarioFila {
  PasswordHash: string;
}

function aUsuario(f: UsuarioFila): Usuario {
  return {
    id: f.IDUsuario,
    nombres: f.Nombres,
    apellidos: f.Apellidos,
    correo: f.Correo,
    telefono: f.Telefono,
    rol: f.Rol,
    activo: f.Activo,
  };
}

export async function obtenerUsuario(idUsuario: number): Promise<Usuario | null> {
  const r = await ejecutarSP<UsuarioFila>('dbo.SP_Seguridad_ObtenerUsuario', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
  ]);
  const fila = r.recordset[0];
  return fila ? aUsuario(fila) : null;
}

// El hash va separado del usuario para que no termine por accidente en una respuesta.
export async function obtenerCredenciales(
  correo: string,
): Promise<{ usuario: Usuario; passwordHash: string } | null> {
  const r = await ejecutarSP<CredencialesFila>('dbo.SP_Seguridad_ObtenerCredenciales', [
    { nombre: 'Correo', tipo: sql.NVarChar(254), valor: correo },
  ]);
  const fila = r.recordset[0];
  return fila ? { usuario: aUsuario(fila), passwordHash: fila.PasswordHash } : null;
}

export async function registrarCliente(datos: {
  nombres: string;
  apellidos: string;
  correo: string;
  passwordHash: string;
  telefono?: string;
}): Promise<Usuario> {
  const r = await ejecutarSP<UsuarioFila>('dbo.SP_Seguridad_RegistrarCliente', [
    { nombre: 'Nombres', tipo: sql.NVarChar(100), valor: datos.nombres },
    { nombre: 'Apellidos', tipo: sql.NVarChar(100), valor: datos.apellidos },
    { nombre: 'Correo', tipo: sql.NVarChar(254), valor: datos.correo },
    { nombre: 'PasswordHash', tipo: sql.VarChar(255), valor: datos.passwordHash },
    { nombre: 'Telefono', tipo: sql.VarChar(20), valor: datos.telefono ?? null },
  ]);
  return aUsuario(r.recordset[0]);
}

export async function crearRefreshToken(
  idUsuario: number,
  tokenHash: string,
  idFamilia: string,
  diasVigencia: number,
): Promise<void> {
  await ejecutarSP('dbo.SP_Seguridad_CrearRefreshToken', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'TokenHash', tipo: sql.Char(64), valor: tokenHash },
    { nombre: 'IDFamilia', tipo: sql.UniqueIdentifier, valor: idFamilia },
    { nombre: 'DiasVigencia', tipo: sql.Int, valor: diasVigencia },
  ]);
}

export async function rotarRefreshToken(
  tokenHashActual: string,
  tokenHashNuevo: string,
  diasVigencia: number,
): Promise<Usuario> {
  const r = await ejecutarSP<UsuarioFila>('dbo.SP_Seguridad_RotarRefreshToken', [
    { nombre: 'TokenHashActual', tipo: sql.Char(64), valor: tokenHashActual },
    { nombre: 'TokenHashNuevo', tipo: sql.Char(64), valor: tokenHashNuevo },
    { nombre: 'DiasVigencia', tipo: sql.Int, valor: diasVigencia },
  ]);
  return aUsuario(r.recordset[0]);
}

export async function revocarRefreshToken(tokenHash: string): Promise<void> {
  await ejecutarSP('dbo.SP_Seguridad_RevocarRefreshToken', [
    { nombre: 'TokenHash', tipo: sql.Char(64), valor: tokenHash },
  ]);
}
