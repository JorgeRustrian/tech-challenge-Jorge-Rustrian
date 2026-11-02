import { Router } from 'express';
import { obtenerPool } from './db/conexion';
import { authRutas } from './modulos/auth/auth.rutas';
import { bitacoraRutas } from './modulos/bitacora/bitacora.rutas';
import { carritoRutas } from './modulos/carrito/carrito.rutas';
import { catalogoAdminRutas, catalogoRutas } from './modulos/catalogo/catalogo.rutas';
import { checkoutRutas } from './modulos/checkout/checkout.rutas';
import { cuponesRutas } from './modulos/cupones/cupones.rutas';
import { direccionesRutas } from './modulos/direcciones/direcciones.rutas';
import { inventarioRutas } from './modulos/inventario/inventario.rutas';
import { misPedidosRutas, pedidosAdminRutas } from './modulos/pedidos/pedidos.rutas';
import { reportesRutas } from './modulos/reportes/reportes.rutas';
import { usuariosRutas } from './modulos/usuarios/usuarios.rutas';

export const rutas = Router();

rutas.use('/auth', authRutas);
rutas.use('/catalogo', catalogoRutas);
rutas.use('/carrito', carritoRutas);
rutas.use('/direcciones', direccionesRutas);
rutas.use('/checkout', checkoutRutas);
rutas.use('/pedidos', misPedidosRutas);
rutas.use('/admin/catalogo', catalogoAdminRutas);
rutas.use('/admin/inventario', inventarioRutas);
rutas.use('/admin/cupones', cuponesRutas);
rutas.use('/admin/pedidos', pedidosAdminRutas);
rutas.use('/admin/reportes', reportesRutas);
rutas.use('/admin/bitacora', bitacoraRutas);
rutas.use('/admin/usuarios', usuariosRutas);

// Sin consultas: solo confirma que el pool está conectado.
rutas.get('/salud', async (_req, res) => {
  const pool = await obtenerPool();
  res.json({ estado: 'ok', baseDatos: pool.connected ? 'conectada' : 'desconectada' });
});
