import { solicitar } from './cliente';

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  cantidadProductos: number;
}

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

export interface VarianteTienda {
  id: number;
  sku: string;
  talla: string | null;
  color: string | null;
  precio: number;
  existenciaDisponible: number;
}

export interface ProductoDetalle {
  id: number;
  idCategoria: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  imagenes: { url: string; orden: number }[];
  variantes: VarianteTienda[];
}

export const ORDENES_CATALOGO = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'precio_asc', etiqueta: 'Precio: menor a mayor' },
  { valor: 'precio_desc', etiqueta: 'Precio: mayor a menor' },
  { valor: 'nombre', etiqueta: 'Nombre (A–Z)' },
] as const;

export function obtenerCategorias(senal?: AbortSignal): Promise<Categoria[]> {
  return solicitar<Categoria[]>('/catalogo/categorias', { senal });
}

// Incluye las categorías inactivas.
export function obtenerCategoriasPanel(senal?: AbortSignal): Promise<Categoria[]> {
  return solicitar<Categoria[]>('/admin/catalogo/categorias', { senal });
}

export function obtenerProducto(id: number, senal?: AbortSignal): Promise<ProductoDetalle> {
  return solicitar<ProductoDetalle>(`/catalogo/productos/${id}`, { senal });
}

/* ---- Panel ---- */

export interface ProductoPanel {
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

export interface VariantePanel {
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

export interface ProductoPanelDetalle {
  id: number;
  idCategoria: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion: string | null;
  imagenes: { id: number; url: string; orden: number }[];
  variantes: VariantePanel[];
}

export interface DatosCategoria {
  nombre: string;
  descripcion: string | null;
}

export interface DatosProducto {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  imagenes: string[];
}

export interface DatosVariante {
  sku: string;
  talla: string | null;
  color: string | null;
  precio: number;
  existenciaInicial?: number;
}

const ADMIN = '/admin/catalogo';

export const crearCategoria = (datos: DatosCategoria) =>
  solicitar<Categoria>(`${ADMIN}/categorias`, { metodo: 'POST', cuerpo: datos });
export const actualizarCategoria = (id: number, datos: DatosCategoria) =>
  solicitar<Categoria>(`${ADMIN}/categorias/${id}`, { metodo: 'PUT', cuerpo: datos });
export const cambiarEstadoCategoria = (id: number, activo: boolean) =>
  solicitar<Categoria>(`${ADMIN}/categorias/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } });
export const eliminarCategoria = (id: number) => solicitar<void>(`${ADMIN}/categorias/${id}`, { metodo: 'DELETE' });

export const obtenerProductoPanel = (id: number, senal?: AbortSignal) =>
  solicitar<ProductoPanelDetalle>(`${ADMIN}/productos/${id}`, { senal });
export const crearProducto = (datos: DatosProducto) =>
  solicitar<ProductoPanelDetalle>(`${ADMIN}/productos`, { metodo: 'POST', cuerpo: datos });
export const actualizarProducto = (id: number, datos: DatosProducto) =>
  solicitar<ProductoPanelDetalle>(`${ADMIN}/productos/${id}`, { metodo: 'PUT', cuerpo: datos });
export const cambiarEstadoProducto = (id: number, activo: boolean) =>
  solicitar<ProductoPanelDetalle>(`${ADMIN}/productos/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } });
export const eliminarProducto = (id: number) => solicitar<void>(`${ADMIN}/productos/${id}`, { metodo: 'DELETE' });

export const crearVariante = (idProducto: number, datos: DatosVariante) =>
  solicitar<VariantePanel>(`${ADMIN}/productos/${idProducto}/variantes`, { metodo: 'POST', cuerpo: datos });
export const actualizarVariante = (id: number, datos: DatosVariante) =>
  solicitar<VariantePanel>(`${ADMIN}/variantes/${id}`, { metodo: 'PUT', cuerpo: datos });
export const cambiarEstadoVariante = (id: number, activo: boolean) =>
  solicitar<VariantePanel>(`${ADMIN}/variantes/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } });
