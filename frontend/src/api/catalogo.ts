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

export function obtenerProducto(id: number, senal?: AbortSignal): Promise<ProductoDetalle> {
  return solicitar<ProductoDetalle>(`/catalogo/productos/${id}`, { senal });
}
