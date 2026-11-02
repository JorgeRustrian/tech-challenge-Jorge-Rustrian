import sql from 'mssql';
import { ejecutarSP } from '../../db/ejecutarSP';
import type { Rol } from '../../tipos/auth';
import type { ActualizarUsuarioInput, ListarUsuariosQuery } from './usuarios.schemas';

interface UsuarioFila {
  IDUsuario: number;
  Nombres: string;
  Apellidos: string;
  Correo: string;
  Telefono: string | null;
  Rol: Rol;
  Activo: boolean;
  FechaCreacion: Date;
  FechaModificacion: Date | null;
  UltimaSesion: Date | null;
  CantidadPedidos: number;
}

export interface UsuarioAdmin {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  fechaCreacion: Date;
  fechaModificacion: Date | null;
  ultimaSesion: Date | null;
  cantidadPedidos: number;
}

function aUsuario(f: UsuarioFila): UsuarioAdmin {
  return {
    id: f.IDUsuario,
    nombres: f.Nombres,
    apellidos: f.Apellidos,
    correo: f.Correo,
    telefono: f.Telefono,
    rol: f.Rol,
    activo: f.Activo,
    fechaCreacion: f.FechaCreacion,
    fechaModificacion: f.FechaModificacion,
    ultimaSesion: f.UltimaSesion,
    cantidadPedidos: f.CantidadPedidos,
  };
}

// Todas reciben al administrador que ejecuta: el SP verifica en la BD que siga activo y con ese rol.
export async function listar(
  q: ListarUsuariosQuery,
  idAdmin: number,
): Promise<{ total: number; usuarios: UsuarioAdmin[] }> {
  const r = await ejecutarSP<[{ Total: number }, UsuarioFila]>('dbo.SP_Usuarios_Listar', [
    { nombre: 'Texto', tipo: sql.NVarChar(100), valor: q.texto ?? null },
    { nombre: 'Rol', tipo: sql.VarChar(20), valor: q.rol ?? null },
    { nombre: 'Activo', tipo: sql.Bit, valor: q.activo ?? null },
    { nombre: 'Pagina', tipo: sql.Int, valor: q.pagina },
    { nombre: 'TamanioPagina', tipo: sql.Int, valor: q.tamanio },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idAdmin },
  ]);
  return { total: r.recordsets[0][0].Total, usuarios: r.recordsets[1].map(aUsuario) };
}

export async function obtener(idUsuario: number, idAdmin: number): Promise<UsuarioAdmin> {
  const r = await ejecutarSP<UsuarioFila>('dbo.SP_Usuarios_Obtener', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idAdmin },
  ]);
  return aUsuario(r.recordset[0]);
}

export async function crear(
  datos: ActualizarUsuarioInput & { passwordHash: string },
  idAdmin: number,
): Promise<UsuarioAdmin> {
  const r = await ejecutarSP<UsuarioFila>('dbo.SP_Usuarios_Crear', [
    { nombre: 'Nombres', tipo: sql.NVarChar(100), valor: datos.nombres },
    { nombre: 'Apellidos', tipo: sql.NVarChar(100), valor: datos.apellidos },
    { nombre: 'Correo', tipo: sql.NVarChar(254), valor: datos.correo },
    { nombre: 'PasswordHash', tipo: sql.VarChar(255), valor: datos.passwordHash },
    { nombre: 'Telefono', tipo: sql.VarChar(20), valor: datos.telefono },
    { nombre: 'Rol', tipo: sql.VarChar(20), valor: datos.rol },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idAdmin },
  ]);
  return aUsuario(r.recordset[0]);
}

export async function actualizar(
  idUsuario: number,
  datos: ActualizarUsuarioInput,
  idAdmin: number,
): Promise<UsuarioAdmin> {
  const r = await ejecutarSP<UsuarioFila>('dbo.SP_Usuarios_Actualizar', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'Nombres', tipo: sql.NVarChar(100), valor: datos.nombres },
    { nombre: 'Apellidos', tipo: sql.NVarChar(100), valor: datos.apellidos },
    { nombre: 'Correo', tipo: sql.NVarChar(254), valor: datos.correo },
    { nombre: 'Telefono', tipo: sql.VarChar(20), valor: datos.telefono },
    { nombre: 'Rol', tipo: sql.VarChar(20), valor: datos.rol },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idAdmin },
  ]);
  return aUsuario(r.recordset[0]);
}

export async function cambiarEstado(idUsuario: number, activo: boolean, idAdmin: number): Promise<UsuarioAdmin> {
  const r = await ejecutarSP<UsuarioFila>('dbo.SP_Usuarios_CambiarEstado', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'Activo', tipo: sql.Bit, valor: activo },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idAdmin },
  ]);
  return aUsuario(r.recordset[0]);
}

export async function cambiarPassword(idUsuario: number, passwordHash: string, idAdmin: number): Promise<void> {
  await ejecutarSP('dbo.SP_Usuarios_CambiarPassword', [
    { nombre: 'IDUsuario', tipo: sql.Int, valor: idUsuario },
    { nombre: 'PasswordHash', tipo: sql.VarChar(255), valor: passwordHash },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idAdmin },
  ]);
}
