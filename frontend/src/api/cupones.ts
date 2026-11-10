import { solicitar } from './cliente';

export type EstadoCupon = 'VIGENTE' | 'PROGRAMADO' | 'VENCIDO' | 'AGOTADO' | 'INACTIVO';

export interface Cupon {
  id: number;
  codigo: string;
  descripcion: string | null;
  tipoDescuento: 'PORCENTAJE' | 'MONTO';
  valor: number;
  montoMinimo: number;
  fechaInicio: string;
  fechaFin: string;
  limiteUsosTotal: number;
  limiteUsosCliente: number;
  usosActuales: number;
  idCategoria: number | null;
  categoria: string | null;
  activo: boolean;
  estado: EstadoCupon;
}

export type DatosCupon = Omit<Cupon, 'id' | 'usosActuales' | 'categoria' | 'activo' | 'estado'>;

export const ESTADOS_CUPON: { valor: EstadoCupon; etiqueta: string }[] = [
  { valor: 'VIGENTE', etiqueta: 'Vigente' },
  { valor: 'PROGRAMADO', etiqueta: 'Programado' },
  { valor: 'VENCIDO', etiqueta: 'Vencido' },
  { valor: 'AGOTADO', etiqueta: 'Agotado' },
  { valor: 'INACTIVO', etiqueta: 'Inactivo' },
];

const BASE = '/admin/cupones';

export const crearCupon = (datos: DatosCupon) => solicitar<Cupon>(BASE, { metodo: 'POST', cuerpo: datos });
export const actualizarCupon = (id: number, datos: DatosCupon) =>
  solicitar<Cupon>(`${BASE}/${id}`, { metodo: 'PUT', cuerpo: datos });
export const cambiarEstadoCupon = (id: number, activo: boolean) =>
  solicitar<Cupon>(`${BASE}/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } });
export const eliminarCupon = (id: number) => solicitar<void>(`${BASE}/${id}`, { metodo: 'DELETE' });
