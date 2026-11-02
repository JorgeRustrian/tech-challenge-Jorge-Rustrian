import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import * as controlador from './checkout.controller';
import { pagarSchema } from './checkout.schemas';

export const checkoutRutas = Router();

checkoutRutas.use(autenticar, autorizar('CLIENTE'));

checkoutRutas.get('/', controlador.obtener);
checkoutRutas.post('/iniciar', controlador.iniciarPago);
checkoutRutas.post('/pagar', validar({ body: pagarSchema }), controlador.pagar);
