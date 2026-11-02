import { z } from 'zod';
import { textoOpcional } from '../../utils/esquemas';

export const direccionSchema = z.object({
  alias: z.string().trim().min(1).max(50),
  nombreDestinatario: z.string().trim().min(1).max(150),
  telefono: z.string().trim().regex(/^\d{8,15}$/, 'El telefono debe tener entre 8 y 15 digitos'),
  direccionLinea: z.string().trim().min(1).max(250),
  zona: z.number().int().min(1).max(25).nullable().default(null),
  municipio: z.string().trim().min(1).max(100),
  departamento: z.string().trim().min(1).max(100),
  referencias: textoOpcional(250),
  esPredeterminada: z.boolean().default(false),
});

// La predeterminada se cambia con su propio endpoint.
export const direccionActualizarSchema = direccionSchema.omit({ esPredeterminada: true });

export type DireccionInput = z.infer<typeof direccionSchema>;
export type DireccionActualizarInput = z.infer<typeof direccionActualizarSchema>;
