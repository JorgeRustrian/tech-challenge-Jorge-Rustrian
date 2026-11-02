import sql from 'mssql';
import { ejecutarSP, type ParametroSP } from '../../db/ejecutarSP';
import type { CuponInput, ListarCuponesQuery } from './cupones.schemas';

interface CuponFila {
  IDCupon: number;
  Codigo: string;
  Descripcion: string | null;
  TipoDescuento: 'PORCENTAJE' | 'MONTO';
  Valor: number;
  MontoMinimo: number;
  FechaInicio: Date;
  FechaFin: Date;
  LimiteUsosTotal: number;
  LimiteUsosCliente: number;
  UsosActuales: number;
  IDCategoria: number | null;
  Categoria: string | null;
  Activo: boolean;
  Estado: string;
}

export interface Cupon {
  id: number;
  codigo: string;
  descripcion: string | null;
  tipoDescuento: 'PORCENTAJE' | 'MONTO';
  valor: number;
  montoMinimo: number;
  fechaInicio: Date;
  fechaFin: Date;
  limiteUsosTotal: number;
  limiteUsosCliente: number;
  usosActuales: number;
  idCategoria: number | null;
  categoria: string | null;
  activo: boolean;
  estado: string;
}

function aCupon(f: CuponFila): Cupon {
  return {
    id: f.IDCupon,
    codigo: f.Codigo,
    descripcion: f.Descripcion,
    tipoDescuento: f.TipoDescuento,
    valor: f.Valor,
    montoMinimo: f.MontoMinimo,
    fechaInicio: f.FechaInicio,
    fechaFin: f.FechaFin,
    limiteUsosTotal: f.LimiteUsosTotal,
    limiteUsosCliente: f.LimiteUsosCliente,
    usosActuales: f.UsosActuales,
    idCategoria: f.IDCategoria,
    categoria: f.Categoria,
    activo: f.Activo,
    estado: f.Estado,
  };
}

function parametrosCupon(datos: CuponInput): ParametroSP[] {
  return [
    { nombre: 'Codigo', tipo: sql.VarChar(30), valor: datos.codigo },
    { nombre: 'Descripcion', tipo: sql.NVarChar(250), valor: datos.descripcion },
    { nombre: 'TipoDescuento', tipo: sql.VarChar(10), valor: datos.tipoDescuento },
    { nombre: 'Valor', tipo: sql.Decimal(12, 2), valor: datos.valor },
    { nombre: 'MontoMinimo', tipo: sql.Decimal(12, 2), valor: datos.montoMinimo },
    { nombre: 'FechaInicio', tipo: sql.DateTime2(3), valor: new Date(datos.fechaInicio) },
    { nombre: 'FechaFin', tipo: sql.DateTime2(3), valor: new Date(datos.fechaFin) },
    { nombre: 'LimiteUsosTotal', tipo: sql.Int, valor: datos.limiteUsosTotal },
    { nombre: 'LimiteUsosCliente', tipo: sql.Int, valor: datos.limiteUsosCliente },
    { nombre: 'IDCategoria', tipo: sql.Int, valor: datos.idCategoria },
  ];
}

export async function listar(q: ListarCuponesQuery): Promise<{ total: number; cupones: Cupon[] }> {
  const r = await ejecutarSP<[{ Total: number }, CuponFila]>('dbo.SP_Cupones_Listar', [
    { nombre: 'Texto', tipo: sql.NVarChar(100), valor: q.texto ?? null },
    { nombre: 'Estado', tipo: sql.VarChar(15), valor: q.estado ?? null },
    { nombre: 'Pagina', tipo: sql.Int, valor: q.pagina },
    { nombre: 'TamanioPagina', tipo: sql.Int, valor: q.tamanio },
  ]);
  return { total: r.recordsets[0][0].Total, cupones: r.recordsets[1].map(aCupon) };
}

export async function obtener(idCupon: number): Promise<Cupon> {
  const r = await ejecutarSP<CuponFila>('dbo.SP_Cupones_Obtener', [
    { nombre: 'IDCupon', tipo: sql.Int, valor: idCupon },
  ]);
  return aCupon(r.recordset[0]);
}

export async function crear(datos: CuponInput, idUsuario: number): Promise<Cupon> {
  const r = await ejecutarSP<CuponFila>('dbo.SP_Cupones_Crear', [
    ...parametrosCupon(datos),
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aCupon(r.recordset[0]);
}

export async function actualizar(idCupon: number, datos: CuponInput, idUsuario: number): Promise<Cupon> {
  const r = await ejecutarSP<CuponFila>('dbo.SP_Cupones_Actualizar', [
    { nombre: 'IDCupon', tipo: sql.Int, valor: idCupon },
    ...parametrosCupon(datos),
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aCupon(r.recordset[0]);
}

export async function cambiarEstado(idCupon: number, activo: boolean, idUsuario: number): Promise<Cupon> {
  const r = await ejecutarSP<CuponFila>('dbo.SP_Cupones_CambiarEstado', [
    { nombre: 'IDCupon', tipo: sql.Int, valor: idCupon },
    { nombre: 'Activo', tipo: sql.Bit, valor: activo },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aCupon(r.recordset[0]);
}

export async function eliminar(idCupon: number, idUsuario: number): Promise<void> {
  await ejecutarSP('dbo.SP_Cupones_Eliminar', [
    { nombre: 'IDCupon', tipo: sql.Int, valor: idCupon },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
}
