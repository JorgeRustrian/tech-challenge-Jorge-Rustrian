import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import { estadoSchema, idParamSchema } from '../../utils/esquemas';
import * as controlador from './cupones.controller';
import { cuponSchema, listarCuponesSchema } from './cupones.schemas';

const conId = validar({ params: idParamSchema });

export const cuponesRutas = Router();

cuponesRutas.use(autenticar, autorizar('ADMIN'));

cuponesRutas.get('/', validar({ query: listarCuponesSchema }), controlador.listar);
cuponesRutas.get('/:id', conId, controlador.obtener);
cuponesRutas.post('/', validar({ body: cuponSchema }), controlador.crear);
cuponesRutas.put('/:id', conId, validar({ body: cuponSchema }), controlador.actualizar);
cuponesRutas.patch('/:id/estado', conId, validar({ body: estadoSchema }), controlador.cambiarEstado);
cuponesRutas.delete('/:id', conId, controlador.eliminar);
