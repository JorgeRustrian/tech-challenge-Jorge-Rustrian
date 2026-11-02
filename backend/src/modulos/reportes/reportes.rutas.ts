import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import * as controlador from './reportes.controller';
import {
  carritosAbandonadosSchema,
  productosMasVendidosSchema,
  rangoReporteSchema,
  ventasPorPeriodoSchema,
} from './reportes.schemas';

export const reportesRutas = Router();

reportesRutas.use(autenticar, autorizar('ADMIN'));

reportesRutas.get('/resumen', validar({ query: rangoReporteSchema }), controlador.resumen);
reportesRutas.get('/ventas', validar({ query: ventasPorPeriodoSchema }), controlador.ventasPorPeriodo);
reportesRutas.get('/ventas-por-categoria', validar({ query: rangoReporteSchema }), controlador.ventasPorCategoria);
reportesRutas.get('/productos-mas-vendidos', validar({ query: productosMasVendidosSchema }), controlador.productosMasVendidos);
reportesRutas.get('/carritos-abandonados', validar({ query: carritosAbandonadosSchema }), controlador.carritosAbandonados);
