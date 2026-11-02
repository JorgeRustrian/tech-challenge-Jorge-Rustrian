import sql from 'mssql';
import { ejecutarSP } from '../../db/ejecutarSP';
import type {
  CategoriaInput,
  ProductoActualizarInput,
  ProductoCrearInput,
  VarianteActualizarInput,
  VarianteCrearInput,
} from './catalogo.schemas';

/* ---- Filas tal como las devuelven los SPs ---- */

interface CategoriaFila {
  IDCategoria: number;
  Nombre: string;
  Descripcion: string | null;
  Activo: boolean;
  CantidadProductos: number;
}

interface ProductoResumenFila {
  IDProducto: number;
  Nombre: string;
  IDCategoria: number;
  Categoria: string;
  Activo: boolean;
  PrecioMin: number | null;
  PrecioMax: number | null;
  ExistenciaDisponible: number;
  CantidadVariantes: number;
  ImagenPrincipal: string | null;
}

interface ProductoFila {
  IDProducto: number;
  IDCategoria: number;
  Categoria: string;
  Nombre: string;
  Descripcion: string | null;
  Activo: boolean;
  FechaCreacion: Date;
  FechaModificacion: Date | null;
}

interface ImagenFila {
  IDProductoImagen: number;
  Url: string;
  Orden: number;
}

interface VarianteFila {
  IDVariante: number;
  IDProducto: number;
  SKU: string;
  Talla: string | null;
  Color: string | null;
  Precio: number;
  ExistenciaFisica: number;
  ExistenciaReservada: number;
  ExistenciaDisponible: number;
  Activo: boolean;
}

/* ---- Modelos que usa el resto del backend ---- */

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  cantidadProductos: number;
}

export interface ProductoResumen {
  id: number;
  nombre: string;
  idCategoria: number;
  categoria: string;
  activo: boolean;
  precioMin: number | null;
  precioMax: number | null;
  existenciaDisponible: number;
  cantidadVariantes: number;
  imagenPrincipal: string | null;
}

export interface Imagen {
  id: number;
  url: string;
  orden: number;
}

export interface Variante {
  id: number;
  idProducto: number;
  sku: string;
  talla: string | null;
  color: string | null;
  precio: number;
  existenciaFisica: number;
  existenciaReservada: number;
  existenciaDisponible: number;
  activo: boolean;
}

export interface ProductoDetalle {
  id: number;
  idCategoria: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: Date;
  fechaModificacion: Date | null;
  imagenes: Imagen[];
  variantes: Variante[];
}

export interface FiltrosProductos {
  texto?: string;
  idCategoria?: number;
  precioMin?: number;
  precioMax?: number;
  soloDisponibles: boolean;
  activo?: boolean;
  incluirInactivos: boolean;
  orden: string;
  pagina: number;
  tamanio: number;
}

function aCategoria(f: CategoriaFila): Categoria {
  return {
    id: f.IDCategoria,
    nombre: f.Nombre,
    descripcion: f.Descripcion,
    activo: f.Activo,
    cantidadProductos: f.CantidadProductos,
  };
}

function aVariante(f: VarianteFila): Variante {
  return {
    id: f.IDVariante,
    idProducto: f.IDProducto,
    sku: f.SKU,
    talla: f.Talla,
    color: f.Color,
    precio: f.Precio,
    existenciaFisica: f.ExistenciaFisica,
    existenciaReservada: f.ExistenciaReservada,
    existenciaDisponible: f.ExistenciaDisponible,
    activo: f.Activo,
  };
}

// Los SPs que devuelven un producto entregan tres resultados: producto, imágenes y variantes.
function aProductoDetalle(
  producto: ProductoFila,
  imagenes: ImagenFila[],
  variantes: VarianteFila[],
): ProductoDetalle {
  return {
    id: producto.IDProducto,
    idCategoria: producto.IDCategoria,
    categoria: producto.Categoria,
    nombre: producto.Nombre,
    descripcion: producto.Descripcion,
    activo: producto.Activo,
    fechaCreacion: producto.FechaCreacion,
    fechaModificacion: producto.FechaModificacion,
    imagenes: imagenes.map((i) => ({ id: i.IDProductoImagen, url: i.Url, orden: i.Orden })),
    variantes: variantes.map(aVariante),
  };
}

async function ejecutarSPProducto(nombreSP: string, parametros: Parameters<typeof ejecutarSP>[1]) {
  const r = await ejecutarSP<[ProductoFila, ImagenFila, VarianteFila]>(nombreSP, parametros);
  return aProductoDetalle(r.recordsets[0][0], r.recordsets[1], r.recordsets[2]);
}

/* ---- Categorías ---- */

export async function listarCategorias(incluirInactivas: boolean): Promise<Categoria[]> {
  const r = await ejecutarSP<CategoriaFila>('dbo.SP_Catalogo_ListarCategorias', [
    { nombre: 'IncluirInactivas', tipo: sql.Bit, valor: incluirInactivas },
  ]);
  return r.recordset.map(aCategoria);
}

export async function crearCategoria(datos: CategoriaInput, idUsuario: number): Promise<Categoria> {
  const r = await ejecutarSP<CategoriaFila>('dbo.SP_Catalogo_CrearCategoria', [
    { nombre: 'Nombre', tipo: sql.NVarChar(100), valor: datos.nombre },
    { nombre: 'Descripcion', tipo: sql.NVarChar(500), valor: datos.descripcion },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aCategoria(r.recordset[0]);
}

export async function actualizarCategoria(
  idCategoria: number,
  datos: CategoriaInput,
  idUsuario: number,
): Promise<Categoria> {
  const r = await ejecutarSP<CategoriaFila>('dbo.SP_Catalogo_ActualizarCategoria', [
    { nombre: 'IDCategoria', tipo: sql.Int, valor: idCategoria },
    { nombre: 'Nombre', tipo: sql.NVarChar(100), valor: datos.nombre },
    { nombre: 'Descripcion', tipo: sql.NVarChar(500), valor: datos.descripcion },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aCategoria(r.recordset[0]);
}

export async function cambiarEstadoCategoria(
  idCategoria: number,
  activo: boolean,
  idUsuario: number,
): Promise<Categoria> {
  const r = await ejecutarSP<CategoriaFila>('dbo.SP_Catalogo_CambiarEstadoCategoria', [
    { nombre: 'IDCategoria', tipo: sql.Int, valor: idCategoria },
    { nombre: 'Activo', tipo: sql.Bit, valor: activo },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aCategoria(r.recordset[0]);
}

export async function eliminarCategoria(idCategoria: number, idUsuario: number): Promise<void> {
  await ejecutarSP('dbo.SP_Catalogo_EliminarCategoria', [
    { nombre: 'IDCategoria', tipo: sql.Int, valor: idCategoria },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
}

/* ---- Productos ---- */

export async function buscarProductos(
  f: FiltrosProductos,
): Promise<{ total: number; productos: ProductoResumen[] }> {
  const r = await ejecutarSP<[{ Total: number }, ProductoResumenFila]>('dbo.SP_Catalogo_BuscarProductos', [
    { nombre: 'Texto', tipo: sql.NVarChar(100), valor: f.texto ?? null },
    { nombre: 'IDCategoria', tipo: sql.Int, valor: f.idCategoria ?? null },
    { nombre: 'PrecioMin', tipo: sql.Decimal(12, 2), valor: f.precioMin ?? null },
    { nombre: 'PrecioMax', tipo: sql.Decimal(12, 2), valor: f.precioMax ?? null },
    { nombre: 'SoloDisponibles', tipo: sql.Bit, valor: f.soloDisponibles },
    { nombre: 'Activo', tipo: sql.Bit, valor: f.activo ?? null },
    { nombre: 'IncluirInactivos', tipo: sql.Bit, valor: f.incluirInactivos },
    { nombre: 'Orden', tipo: sql.VarChar(20), valor: f.orden },
    { nombre: 'Pagina', tipo: sql.Int, valor: f.pagina },
    { nombre: 'TamanioPagina', tipo: sql.Int, valor: f.tamanio },
  ]);

  return {
    total: r.recordsets[0][0].Total,
    productos: r.recordsets[1].map((p) => ({
      id: p.IDProducto,
      nombre: p.Nombre,
      idCategoria: p.IDCategoria,
      categoria: p.Categoria,
      activo: p.Activo,
      precioMin: p.PrecioMin,
      precioMax: p.PrecioMax,
      existenciaDisponible: p.ExistenciaDisponible,
      cantidadVariantes: p.CantidadVariantes,
      imagenPrincipal: p.ImagenPrincipal,
    })),
  };
}

export async function obtenerProducto(idProducto: number, incluirInactivos: boolean): Promise<ProductoDetalle> {
  return ejecutarSPProducto('dbo.SP_Catalogo_ObtenerProducto', [
    { nombre: 'IDProducto', tipo: sql.Int, valor: idProducto },
    { nombre: 'IncluirInactivos', tipo: sql.Bit, valor: incluirInactivos },
  ]);
}

export async function crearProducto(datos: ProductoCrearInput, idUsuario: number): Promise<ProductoDetalle> {
  return ejecutarSPProducto('dbo.SP_Catalogo_CrearProducto', [
    { nombre: 'IDCategoria', tipo: sql.Int, valor: datos.idCategoria },
    { nombre: 'Nombre', tipo: sql.NVarChar(150), valor: datos.nombre },
    { nombre: 'Descripcion', tipo: sql.NVarChar(2000), valor: datos.descripcion },
    { nombre: 'Imagenes', tipo: sql.NVarChar(sql.MAX), valor: JSON.stringify(datos.imagenes) },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
}

export async function actualizarProducto(
  idProducto: number,
  datos: ProductoActualizarInput,
  idUsuario: number,
): Promise<ProductoDetalle> {
  return ejecutarSPProducto('dbo.SP_Catalogo_ActualizarProducto', [
    { nombre: 'IDProducto', tipo: sql.Int, valor: idProducto },
    { nombre: 'IDCategoria', tipo: sql.Int, valor: datos.idCategoria },
    { nombre: 'Nombre', tipo: sql.NVarChar(150), valor: datos.nombre },
    { nombre: 'Descripcion', tipo: sql.NVarChar(2000), valor: datos.descripcion },
    {
      nombre: 'Imagenes',
      tipo: sql.NVarChar(sql.MAX),
      valor: datos.imagenes ? JSON.stringify(datos.imagenes) : null,
    },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
}

export async function cambiarEstadoProducto(
  idProducto: number,
  activo: boolean,
  idUsuario: number,
): Promise<ProductoDetalle> {
  return ejecutarSPProducto('dbo.SP_Catalogo_CambiarEstadoProducto', [
    { nombre: 'IDProducto', tipo: sql.Int, valor: idProducto },
    { nombre: 'Activo', tipo: sql.Bit, valor: activo },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
}

export async function eliminarProducto(idProducto: number, idUsuario: number): Promise<void> {
  await ejecutarSP('dbo.SP_Catalogo_EliminarProducto', [
    { nombre: 'IDProducto', tipo: sql.Int, valor: idProducto },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
}

/* ---- Variantes ---- */

export async function crearVariante(
  idProducto: number,
  datos: VarianteCrearInput,
  idUsuario: number,
): Promise<Variante> {
  const r = await ejecutarSP<VarianteFila>('dbo.SP_Catalogo_CrearVariante', [
    { nombre: 'IDProducto', tipo: sql.Int, valor: idProducto },
    { nombre: 'SKU', tipo: sql.VarChar(50), valor: datos.sku },
    { nombre: 'Talla', tipo: sql.NVarChar(20), valor: datos.talla },
    { nombre: 'Color', tipo: sql.NVarChar(30), valor: datos.color },
    { nombre: 'Precio', tipo: sql.Decimal(12, 2), valor: datos.precio },
    { nombre: 'ExistenciaInicial', tipo: sql.Int, valor: datos.existenciaInicial },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aVariante(r.recordset[0]);
}

export async function actualizarVariante(
  idVariante: number,
  datos: VarianteActualizarInput,
  idUsuario: number,
): Promise<Variante> {
  const r = await ejecutarSP<VarianteFila>('dbo.SP_Catalogo_ActualizarVariante', [
    { nombre: 'IDVariante', tipo: sql.Int, valor: idVariante },
    { nombre: 'SKU', tipo: sql.VarChar(50), valor: datos.sku },
    { nombre: 'Talla', tipo: sql.NVarChar(20), valor: datos.talla },
    { nombre: 'Color', tipo: sql.NVarChar(30), valor: datos.color },
    { nombre: 'Precio', tipo: sql.Decimal(12, 2), valor: datos.precio },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aVariante(r.recordset[0]);
}

export async function cambiarEstadoVariante(
  idVariante: number,
  activo: boolean,
  idUsuario: number,
): Promise<Variante> {
  const r = await ejecutarSP<VarianteFila>('dbo.SP_Catalogo_CambiarEstadoVariante', [
    { nombre: 'IDVariante', tipo: sql.Int, valor: idVariante },
    { nombre: 'Activo', tipo: sql.Bit, valor: activo },
    { nombre: 'IDUsuarioAccion', tipo: sql.Int, valor: idUsuario },
  ]);
  return aVariante(r.recordset[0]);
}
