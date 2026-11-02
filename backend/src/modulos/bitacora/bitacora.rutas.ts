import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import * as controlador from './bitacora.controller';
import { consultarBitacoraSchema } from './bitacora.schemas';

export const bitacoraRutas = Router();

bitacoraRutas.use(autenticar, autorizar('ADMIN'));

bitacoraRutas.get('/', validar({ query: consultarBitacoraSchema }), controlador.consultar);
