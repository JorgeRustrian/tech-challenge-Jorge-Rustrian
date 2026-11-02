import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../errors/AppError';
import { autenticacionOpcional } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import * as controlador from './carrito.controller';
import { actualizarItemSchema, agregarItemSchema, aplicarCuponSchema, varianteParamSchema } from './carrito.schemas';

// Administradores y operadores no compran.
const soloClientes: RequestHandler = (req, _res, next) => {
  if (req.usuario && req.usuario.rol !== 'CLIENTE') {
    throw new AppError(403, 'Solo los clientes tienen carrito.');
  }
  next();
};

// Evita probar códigos de cupón por fuerza bruta.
const limitarCupones = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { mensaje: 'Demasiados intentos de cupon. Intente de nuevo en unos minutos.' } },
});

const conVariante = validar({ params: varianteParamSchema });

export const carritoRutas = Router();

carritoRutas.use(autenticacionOpcional, soloClientes);

carritoRutas.get('/', controlador.obtener);
carritoRutas.delete('/', controlador.vaciar);

carritoRutas.post('/items', validar({ body: agregarItemSchema }), controlador.agregarItem);
carritoRutas.put('/items/:idVariante', conVariante, validar({ body: actualizarItemSchema }), controlador.actualizarItem);
carritoRutas.delete('/items/:idVariante', conVariante, controlador.eliminarItem);

carritoRutas.post('/cupon', limitarCupones, validar({ body: aplicarCuponSchema }), controlador.aplicarCupon);
carritoRutas.delete('/cupon', controlador.quitarCupon);

carritoRutas.post('/fusionar', controlador.fusionar);
