import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import { idParamSchema } from '../../utils/esquemas';
import * as controlador from './inventario.controller';
import { ajusteSchema, entradaSchema, existenciasQuerySchema, kardexQuerySchema } from './inventario.schemas';

const conId = validar({ params: idParamSchema });

export const inventarioRutas = Router();

inventarioRutas.use(autenticar, autorizar('ADMIN', 'OPERADOR'));

inventarioRutas.get('/existencias', validar({ query: existenciasQuerySchema }), controlador.listarExistencias);
inventarioRutas.get('/conciliacion', controlador.conciliar);
inventarioRutas.get('/variantes/:id/kardex', conId, validar({ query: kardexQuerySchema }), controlador.listarKardex);
inventarioRutas.post('/variantes/:id/entradas', conId, validar({ body: entradaSchema }), controlador.registrarEntrada);
inventarioRutas.post('/variantes/:id/ajustes', conId, validar({ body: ajusteSchema }), controlador.registrarAjuste);
