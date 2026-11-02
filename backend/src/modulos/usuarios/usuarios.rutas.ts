import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/autenticar';
import { validar } from '../../middlewares/validar';
import { estadoSchema, idParamSchema } from '../../utils/esquemas';
import * as controlador from './usuarios.controller';
import {
  actualizarUsuarioSchema,
  cambiarPasswordSchema,
  crearUsuarioSchema,
  listarUsuariosSchema,
} from './usuarios.schemas';

const conId = validar({ params: idParamSchema });

export const usuariosRutas = Router();

usuariosRutas.use(autenticar, autorizar('ADMIN'));

usuariosRutas.get('/', validar({ query: listarUsuariosSchema }), controlador.listar);
usuariosRutas.get('/:id', conId, controlador.obtener);
usuariosRutas.post('/', validar({ body: crearUsuarioSchema }), controlador.crear);
usuariosRutas.put('/:id', conId, validar({ body: actualizarUsuarioSchema }), controlador.actualizar);
usuariosRutas.patch('/:id/estado', conId, validar({ body: estadoSchema }), controlador.cambiarEstado);
usuariosRutas.patch('/:id/password', conId, validar({ body: cambiarPasswordSchema }), controlador.cambiarPassword);
