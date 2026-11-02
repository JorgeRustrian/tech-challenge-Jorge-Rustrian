import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import { idParamSchema } from '../../utils/esquemas';
import * as controlador from './pedidos.controller';
import {
  cambiarEstadoSchema,
  cancelarSchema,
  devolucionSchema,
  listarMisPedidosSchema,
  listarPedidosSchema,
} from './pedidos.schemas';

const conId = validar({ params: idParamSchema });

/* ---- Cliente: /api/pedidos ---- */

export const misPedidosRutas = Router();

misPedidosRutas.use(autenticar, autorizar('CLIENTE'));

misPedidosRutas.get('/', validar({ query: listarMisPedidosSchema }), controlador.listarMisPedidos);
misPedidosRutas.get('/:id', conId, controlador.obtenerMiPedido);
misPedidosRutas.post('/:id/cancelar', conId, validar({ body: cancelarSchema }), controlador.cancelarMiPedido);

/* ---- Operador y Administrador: /api/admin/pedidos ---- */

export const pedidosAdminRutas = Router();

pedidosAdminRutas.use(autenticar, autorizar('ADMIN', 'OPERADOR'));

pedidosAdminRutas.get('/', validar({ query: listarPedidosSchema }), controlador.listarPedidos);
pedidosAdminRutas.get('/:id', conId, controlador.obtenerPedido);
pedidosAdminRutas.patch('/:id/estado', conId, validar({ body: cambiarEstadoSchema }), controlador.cambiarEstado);
pedidosAdminRutas.post('/:id/devoluciones', conId, validar({ body: devolucionSchema }), controlador.registrarDevolucion);
