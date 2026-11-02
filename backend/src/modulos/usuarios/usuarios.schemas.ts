import { z } from 'zod';
import { ROLES } from '../../tipos/auth';
import { textoBusqueda } from '../../utils/esquemas';
import { camposPaginacion } from '../../utils/paginacion';
import { correoSchema, passwordNuevaSchema, telefonoSchema } from '../auth/auth.schemas';

export const listarUsuariosSchema = z.object({
  texto: textoBusqueda,
  rol: z.enum(ROLES).optional(),
  activo: z.stringbool().optional(),
  ...camposPaginacion,
});

const datosUsuario = {
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  correo: correoSchema,
  telefono: telefonoSchema.nullish().transform((v) => v ?? null),
  rol: z.enum(ROLES),
};

export const crearUsuarioSchema = z.object({
  ...datosUsuario,
  password: passwordNuevaSchema,
});

export const actualizarUsuarioSchema = z.object(datosUsuario);

export const cambiarPasswordSchema = z.object({
  password: passwordNuevaSchema,
});

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosSchema>;
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
