import { z } from 'zod';

export const correoSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Correo invalido'));

// bcrypt solo usa los primeros 72 bytes de la contraseña.
export const passwordNuevaSchema = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .max(72, 'La contrasena no puede tener mas de 72 caracteres')
  .regex(/[A-Za-z]/, 'La contrasena debe incluir al menos una letra')
  .regex(/\d/, 'La contrasena debe incluir al menos un numero');

export const telefonoSchema = z.string().trim().regex(/^\d{8,15}$/, 'El telefono debe tener entre 8 y 15 digitos');

export const registroSchema = z.object({
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  correo: correoSchema,
  password: passwordNuevaSchema,
  telefono: telefonoSchema.optional(),
});

export const loginSchema = z.object({
  correo: correoSchema,
  password: z.string().min(1).max(72),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
