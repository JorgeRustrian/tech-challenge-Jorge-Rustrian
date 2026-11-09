export type Valores = Record<string, unknown> | null;

export interface EntradaBitacora {
  id: string;
  fecha: string;
  modulo: string;
  entidad: string;
  idEntidad: number | null;
  accion: string;
  usuario: { id: number; nombre: string; correo: string } | null;
  valorAnterior: Valores;
  valorNuevo: Valores;
}

export const MODULOS_BITACORA = [
  { valor: 'CATALOGO', etiqueta: 'Catálogo' },
  { valor: 'INVENTARIO', etiqueta: 'Inventario' },
  { valor: 'CUPONES', etiqueta: 'Cupones' },
  { valor: 'PEDIDOS', etiqueta: 'Pedidos' },
  { valor: 'SEGURIDAD', etiqueta: 'Seguridad' },
];

export const ACCIONES_BITACORA = [
  { valor: 'CREAR', etiqueta: 'Creó' },
  { valor: 'MODIFICAR', etiqueta: 'Modificó' },
  { valor: 'ACTIVAR', etiqueta: 'Activó' },
  { valor: 'DESACTIVAR', etiqueta: 'Desactivó' },
  { valor: 'ELIMINAR', etiqueta: 'Eliminó' },
];
