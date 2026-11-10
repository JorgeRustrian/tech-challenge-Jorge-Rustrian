import type { VarianteTienda } from '../../api/catalogo';

export interface Seleccion {
  talla: string | null;
  color: string | null;
}

export type EstadoOpcion = 'normal' | 'agotada' | 'inexistente';

const TALLAS_LETRA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

// S, M, L antes que L, M, S; y 39, 40, 41 en orden numérico.
function compararTallas(a: string, b: string): number {
  const ia = TALLAS_LETRA.indexOf(a.toUpperCase());
  const ib = TALLAS_LETRA.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b, 'es');
}

export function opcionesDe(variantes: VarianteTienda[]) {
  const tallas = [...new Set(variantes.map((v) => v.talla).filter((t): t is string => t !== null))].sort(compararTallas);
  const colores = [...new Set(variantes.map((v) => v.color).filter((c): c is string => c !== null))];
  return { tallas, colores };
}

export function buscarVariante(variantes: VarianteTienda[], s: Seleccion): VarianteTienda | undefined {
  return variantes.find((v) => v.talla === s.talla && v.color === s.color);
}

// Al abrir el producto se muestra la primera variante con existencia, en orden de talla.
export function seleccionInicial(variantes: VarianteTienda[]): Seleccion | null {
  const { tallas } = opcionesDe(variantes);
  const ordenadas = [...variantes].sort((a, b) => tallas.indexOf(a.talla ?? '') - tallas.indexOf(b.talla ?? ''));
  const v = ordenadas.find((x) => x.existenciaDisponible > 0) ?? ordenadas[0];
  return v ? { talla: v.talla, color: v.color } : null;
}

// Si la combinación pedida no existe (no hay talla S en celeste), se respeta lo que se acaba de
// elegir y se ajusta la otra opción a una que sí exista, de preferencia con existencia.
export function elegir(variantes: VarianteTienda[], actual: Seleccion, cambio: Partial<Seleccion>): Seleccion {
  const deseada = { ...actual, ...cambio };
  if (buscarVariante(variantes, deseada)) return deseada;

  const clave = 'talla' in cambio ? 'talla' : 'color';
  const candidatas = variantes.filter((v) => v[clave] === deseada[clave]);
  const mejor = candidatas.find((v) => v.existenciaDisponible > 0) ?? candidatas[0];
  return mejor ? { talla: mejor.talla, color: mejor.color } : actual;
}

export function estadoOpcion(variantes: VarianteTienda[], s: Seleccion): EstadoOpcion {
  const v = buscarVariante(variantes, s);
  if (!v) return 'inexistente';
  return v.existenciaDisponible > 0 ? 'normal' : 'agotada';
}
