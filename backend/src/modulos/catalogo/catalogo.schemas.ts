import { z } from 'zod';
import { montoSchema, textoBusqueda, textoOpcional } from '../../utils/esquemas';
import { camposPaginacion } from '../../utils/paginacion';

const filtros = {
  texto: textoBusqueda,
  idCategoria: z.coerce.number().int().positive().optional(),
  precioMin: z.coerce.number().nonnegative().optional(),
  precioMax: z.coerce.number().nonnegative().optional(),
  disponible: z.stringbool().optional(),
  orden: z.enum(['recientes', 'nombre', 'precio_asc', 'precio_desc']).default('recientes'),
  ...camposPaginacion,
};

function rangoDePrecioValido(f: { precioMin?: number; precioMax?: number }): boolean {
  return f.precioMin === undefined || f.precioMax === undefined || f.precioMin <= f.precioMax;
}

const errorRango = { message: 'precioMin no puede ser mayor que precioMax', path: ['precioMin'] };

export const busquedaTiendaSchema = z.object(filtros).refine(rangoDePrecioValido, errorRango);

export const busquedaAdminSchema = z
  .object({ ...filtros, activo: z.stringbool().optional() })
  .refine(rangoDePrecioValido, errorRango);

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  descripcion: textoOpcional(500),
});

const urlImagen = z.string().trim().max(500).pipe(z.url({ protocol: /^https?$/ }));

export const productoCrearSchema = z.object({
  idCategoria: z.number().int().positive(),
  nombre: z.string().trim().min(1).max(150),
  descripcion: textoOpcional(2000),
  imagenes: z.array(urlImagen).max(10).default([]),
});

// Sin "imagenes" se conservan las actuales; con un arreglo se reemplazan.
export const productoActualizarSchema = productoCrearSchema.extend({
  imagenes: z.array(urlImagen).max(10).optional(),
});

const sku = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(50)
  .regex(/^[A-Z0-9-]+$/, 'El SKU solo admite letras, numeros y guiones');

export const varianteCrearSchema = z.object({
  sku,
  talla: textoOpcional(20),
  color: textoOpcional(30),
  precio: montoSchema.refine((v) => v > 0, 'El precio debe ser mayor que cero'),
  existenciaInicial: z.number().int().min(0).max(1_000_000).default(0),
});

export const varianteActualizarSchema = varianteCrearSchema.omit({ existenciaInicial: true });

export type BusquedaTienda = z.infer<typeof busquedaTiendaSchema>;
export type BusquedaAdmin = z.infer<typeof busquedaAdminSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type ProductoCrearInput = z.infer<typeof productoCrearSchema>;
export type ProductoActualizarInput = z.infer<typeof productoActualizarSchema>;
export type VarianteCrearInput = z.infer<typeof varianteCrearSchema>;
export type VarianteActualizarInput = z.infer<typeof varianteActualizarSchema>;
