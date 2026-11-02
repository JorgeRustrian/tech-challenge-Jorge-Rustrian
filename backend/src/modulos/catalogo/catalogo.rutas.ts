import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import { estadoSchema, idParamSchema } from '../../utils/esquemas';
import * as controlador from './catalogo.controller';
import {
  busquedaAdminSchema,
  busquedaTiendaSchema,
  categoriaSchema,
  productoActualizarSchema,
  productoCrearSchema,
  varianteActualizarSchema,
  varianteCrearSchema,
} from './catalogo.schemas';

/* ---- Tienda (público) ---- */

export const catalogoRutas = Router();

catalogoRutas.get('/categorias', controlador.listarCategoriasTienda);
catalogoRutas.get('/productos', validar({ query: busquedaTiendaSchema }), controlador.buscarProductosTienda);
catalogoRutas.get('/productos/:id', validar({ params: idParamSchema }), controlador.obtenerProductoTienda);

/* ---- Administración ---- */

// El Operador puede consultar el catálogo (lo necesita para inventario y pedidos); solo el Administrador lo modifica.
const consultar = autorizar('ADMIN', 'OPERADOR');
const modificar = autorizar('ADMIN');
const conId = validar({ params: idParamSchema });

export const catalogoAdminRutas = Router();

catalogoAdminRutas.use(autenticar);

catalogoAdminRutas.get('/categorias', consultar, controlador.listarCategoriasAdmin);
catalogoAdminRutas.post('/categorias', modificar, validar({ body: categoriaSchema }), controlador.crearCategoria);
catalogoAdminRutas.put('/categorias/:id', modificar, conId, validar({ body: categoriaSchema }), controlador.actualizarCategoria);
catalogoAdminRutas.patch('/categorias/:id/estado', modificar, conId, validar({ body: estadoSchema }), controlador.cambiarEstadoCategoria);
catalogoAdminRutas.delete('/categorias/:id', modificar, conId, controlador.eliminarCategoria);

catalogoAdminRutas.get('/productos', consultar, validar({ query: busquedaAdminSchema }), controlador.buscarProductosAdmin);
catalogoAdminRutas.get('/productos/:id', consultar, conId, controlador.obtenerProductoAdmin);
catalogoAdminRutas.post('/productos', modificar, validar({ body: productoCrearSchema }), controlador.crearProducto);
catalogoAdminRutas.put('/productos/:id', modificar, conId, validar({ body: productoActualizarSchema }), controlador.actualizarProducto);
catalogoAdminRutas.patch('/productos/:id/estado', modificar, conId, validar({ body: estadoSchema }), controlador.cambiarEstadoProducto);
catalogoAdminRutas.delete('/productos/:id', modificar, conId, controlador.eliminarProducto);

catalogoAdminRutas.post('/productos/:id/variantes', modificar, conId, validar({ body: varianteCrearSchema }), controlador.crearVariante);
catalogoAdminRutas.put('/variantes/:id', modificar, conId, validar({ body: varianteActualizarSchema }), controlador.actualizarVariante);
catalogoAdminRutas.patch('/variantes/:id/estado', modificar, conId, validar({ body: estadoSchema }), controlador.cambiarEstadoVariante);
