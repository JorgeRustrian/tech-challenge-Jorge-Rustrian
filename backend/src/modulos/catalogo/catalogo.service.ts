import { paginar, type Paginado } from '../../utils/paginacion';
import * as repositorio from './catalogo.repository';
import type { Categoria, ProductoDetalle, ProductoResumen, Variante } from './catalogo.repository';
import type {
  BusquedaAdmin,
  BusquedaTienda,
  CategoriaInput,
  ProductoActualizarInput,
  ProductoCrearInput,
  VarianteActualizarInput,
  VarianteCrearInput,
} from './catalogo.schemas';

/* ---- Vista de tienda: sin datos internos (existencia física, reservas, estado) ---- */

export interface ProductoTienda {
  id: number;
  nombre: string;
  idCategoria: number;
  categoria: string;
  precioMin: number | null;
  precioMax: number | null;
  disponible: boolean;
  imagenPrincipal: string | null;
}

export interface ProductoTiendaDetalle {
  id: number;
  idCategoria: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  imagenes: { url: string; orden: number }[];
  variantes: {
    id: number;
    sku: string;
    talla: string | null;
    color: string | null;
    precio: number;
    existenciaDisponible: number;
  }[];
}

function aProductoTienda(p: ProductoResumen): ProductoTienda {
  return {
    id: p.id,
    nombre: p.nombre,
    idCategoria: p.idCategoria,
    categoria: p.categoria,
    precioMin: p.precioMin,
    precioMax: p.precioMax,
    disponible: p.existenciaDisponible > 0,
    imagenPrincipal: p.imagenPrincipal,
  };
}

function aProductoTiendaDetalle(p: ProductoDetalle): ProductoTiendaDetalle {
  return {
    id: p.id,
    idCategoria: p.idCategoria,
    categoria: p.categoria,
    nombre: p.nombre,
    descripcion: p.descripcion,
    imagenes: p.imagenes.map((i) => ({ url: i.url, orden: i.orden })),
    variantes: p.variantes.map((v) => ({
      id: v.id,
      sku: v.sku,
      talla: v.talla,
      color: v.color,
      precio: v.precio,
      existenciaDisponible: v.existenciaDisponible,
    })),
  };
}

export function listarCategoriasTienda(): Promise<Categoria[]> {
  return repositorio.listarCategorias(false);
}

export async function buscarProductosTienda(f: BusquedaTienda): Promise<Paginado<ProductoTienda>> {
  const { total, productos } = await repositorio.buscarProductos({
    texto: f.texto,
    idCategoria: f.idCategoria,
    precioMin: f.precioMin,
    precioMax: f.precioMax,
    soloDisponibles: f.disponible ?? false,
    incluirInactivos: false,
    orden: f.orden,
    pagina: f.pagina,
    tamanio: f.tamanio,
  });
  return paginar(productos.map(aProductoTienda), total, f.pagina, f.tamanio);
}

export async function obtenerProductoTienda(idProducto: number): Promise<ProductoTiendaDetalle> {
  return aProductoTiendaDetalle(await repositorio.obtenerProducto(idProducto, false));
}

/* ---- Administración ---- */

export function listarCategoriasAdmin(): Promise<Categoria[]> {
  return repositorio.listarCategorias(true);
}

export function crearCategoria(datos: CategoriaInput, idUsuario: number): Promise<Categoria> {
  return repositorio.crearCategoria(datos, idUsuario);
}

export function actualizarCategoria(id: number, datos: CategoriaInput, idUsuario: number): Promise<Categoria> {
  return repositorio.actualizarCategoria(id, datos, idUsuario);
}

export function cambiarEstadoCategoria(id: number, activo: boolean, idUsuario: number): Promise<Categoria> {
  return repositorio.cambiarEstadoCategoria(id, activo, idUsuario);
}

export function eliminarCategoria(id: number, idUsuario: number): Promise<void> {
  return repositorio.eliminarCategoria(id, idUsuario);
}

export async function buscarProductosAdmin(f: BusquedaAdmin): Promise<Paginado<ProductoResumen>> {
  const { total, productos } = await repositorio.buscarProductos({
    texto: f.texto,
    idCategoria: f.idCategoria,
    precioMin: f.precioMin,
    precioMax: f.precioMax,
    soloDisponibles: f.disponible ?? false,
    activo: f.activo,
    incluirInactivos: true,
    orden: f.orden,
    pagina: f.pagina,
    tamanio: f.tamanio,
  });
  return paginar(productos, total, f.pagina, f.tamanio);
}

export function obtenerProductoAdmin(id: number): Promise<ProductoDetalle> {
  return repositorio.obtenerProducto(id, true);
}

export function crearProducto(datos: ProductoCrearInput, idUsuario: number): Promise<ProductoDetalle> {
  return repositorio.crearProducto(datos, idUsuario);
}

export function actualizarProducto(
  id: number,
  datos: ProductoActualizarInput,
  idUsuario: number,
): Promise<ProductoDetalle> {
  return repositorio.actualizarProducto(id, datos, idUsuario);
}

export function cambiarEstadoProducto(id: number, activo: boolean, idUsuario: number): Promise<ProductoDetalle> {
  return repositorio.cambiarEstadoProducto(id, activo, idUsuario);
}

export function eliminarProducto(id: number, idUsuario: number): Promise<void> {
  return repositorio.eliminarProducto(id, idUsuario);
}

export function crearVariante(idProducto: number, datos: VarianteCrearInput, idUsuario: number): Promise<Variante> {
  return repositorio.crearVariante(idProducto, datos, idUsuario);
}

export function actualizarVariante(id: number, datos: VarianteActualizarInput, idUsuario: number): Promise<Variante> {
  return repositorio.actualizarVariante(id, datos, idUsuario);
}

export function cambiarEstadoVariante(id: number, activo: boolean, idUsuario: number): Promise<Variante> {
  return repositorio.cambiarEstadoVariante(id, activo, idUsuario);
}
