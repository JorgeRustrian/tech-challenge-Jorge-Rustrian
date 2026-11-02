import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import { idParamSchema } from '../../utils/esquemas';
import * as controlador from './direcciones.controller';
import { direccionActualizarSchema, direccionSchema } from './direcciones.schemas';

const conId = validar({ params: idParamSchema });

export const direccionesRutas = Router();

direccionesRutas.use(autenticar, autorizar('CLIENTE'));

direccionesRutas.get('/', controlador.listar);
direccionesRutas.post('/', validar({ body: direccionSchema }), controlador.crear);
direccionesRutas.put('/:id', conId, validar({ body: direccionActualizarSchema }), controlador.actualizar);
direccionesRutas.patch('/:id/predeterminada', conId, controlador.marcarPredeterminada);
direccionesRutas.delete('/:id', conId, controlador.eliminar);
