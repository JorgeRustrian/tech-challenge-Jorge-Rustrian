import type { Rol } from '../api/tipos';
import { PERSONAL } from '../auth/roles';

interface Enlace {
  ruta: string;
  etiqueta: string;
  roles: Rol[];
}

export const SECCIONES_PANEL: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: 'Resumen',
    enlaces: [{ ruta: '/panel/dashboard', etiqueta: 'Dashboard', roles: ['ADMIN'] }],
  },
  {
    titulo: 'Operación',
    enlaces: [
      { ruta: '/panel/pedidos', etiqueta: 'Pedidos', roles: PERSONAL },
      { ruta: '/panel/inventario', etiqueta: 'Inventario', roles: PERSONAL },
    ],
  },
  {
    titulo: 'Catálogo',
    enlaces: [
      { ruta: '/panel/productos', etiqueta: 'Productos', roles: PERSONAL },
      { ruta: '/panel/categorias', etiqueta: 'Categorías', roles: PERSONAL },
      { ruta: '/panel/cupones', etiqueta: 'Cupones', roles: ['ADMIN'] },
    ],
  },
  {
    titulo: 'Administración',
    enlaces: [
      { ruta: '/panel/usuarios', etiqueta: 'Usuarios', roles: ['ADMIN'] },
      { ruta: '/panel/bitacora', etiqueta: 'Bitácora', roles: ['ADMIN'] },
    ],
  },
];

export function seccionesPara(rol: Rol) {
  return SECCIONES_PANEL.map((s) => ({ ...s, enlaces: s.enlaces.filter((e) => e.roles.includes(rol)) })).filter(
    (s) => s.enlaces.length > 0,
  );
}
