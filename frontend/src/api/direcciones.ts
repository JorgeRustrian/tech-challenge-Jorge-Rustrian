import { solicitar } from './cliente';

export interface Direccion {
  id: number;
  alias: string;
  nombreDestinatario: string;
  telefono: string;
  direccionLinea: string;
  zona: number | null;
  municipio: string;
  departamento: string;
  referencias: string | null;
  esPredeterminada: boolean;
}

export type DatosDireccion = Omit<Direccion, 'id' | 'esPredeterminada'> & { esPredeterminada?: boolean };

export const CLAVE_DIRECCIONES = ['direcciones'];

export const DEPARTAMENTOS = [
  'Alta Verapaz',
  'Baja Verapaz',
  'Chimaltenango',
  'Chiquimula',
  'El Progreso',
  'Escuintla',
  'Guatemala',
  'Huehuetenango',
  'Izabal',
  'Jalapa',
  'Jutiapa',
  'Petén',
  'Quetzaltenango',
  'Quiché',
  'Retalhuleu',
  'Sacatepéquez',
  'San Marcos',
  'Santa Rosa',
  'Sololá',
  'Suchitepéquez',
  'Totonicapán',
  'Zacapa',
];

// "4a. Avenida 12-45, zona 10, Guatemala, Guatemala"
export function lineaDireccion(d: Pick<Direccion, 'direccionLinea' | 'zona' | 'municipio' | 'departamento'>): string {
  return [d.direccionLinea, d.zona ? `zona ${d.zona}` : null, d.municipio, d.departamento].filter(Boolean).join(', ');
}

export const listarDirecciones = (senal?: AbortSignal) => solicitar<Direccion[]>('/direcciones', { senal });

export const crearDireccion = (datos: DatosDireccion) =>
  solicitar<Direccion>('/direcciones', { metodo: 'POST', cuerpo: datos });

// La predeterminada no se cambia aquí sino con marcarPredeterminada.
export const actualizarDireccion = (id: number, datos: DatosDireccion) =>
  solicitar<Direccion>(`/direcciones/${id}`, { metodo: 'PUT', cuerpo: { ...datos, esPredeterminada: undefined } });

export const marcarPredeterminada = (id: number) =>
  solicitar<Direccion[]>(`/direcciones/${id}/predeterminada`, { metodo: 'PATCH' });

export const eliminarDireccion = (id: number) => solicitar<void>(`/direcciones/${id}`, { metodo: 'DELETE' });
