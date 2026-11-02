import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { autenticar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import * as controlador from './auth.controller';
import { loginSchema, registroSchema } from './auth.schemas';

// Frena fuerza bruta sobre contraseñas: 10 intentos por IP cada 15 minutos.
const limitarIntentos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { mensaje: 'Demasiados intentos. Intente de nuevo en unos minutos.' } },
});

export const authRutas = Router();

authRutas.post('/registro', limitarIntentos, validar({ body: registroSchema }), controlador.registro);
authRutas.post('/login', limitarIntentos, validar({ body: loginSchema }), controlador.login);
authRutas.post('/refresh', controlador.refrescar);
authRutas.post('/logout', controlador.logout);
authRutas.get('/perfil', autenticar, controlador.perfil);
