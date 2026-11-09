import { z } from 'zod';

// Mismas reglas que valida la API para una contraseña nueva.
export const passwordNueva = z
  .string()
  .min(8, 'Use al menos 8 caracteres')
  .max(72, 'Use como máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Incluya al menos una letra')
  .regex(/\d/, 'Incluya al menos un número');

export const telefonoOpcional = z
  .string()
  .trim()
  .regex(/^(\d{8,15})?$/, 'Solo números, entre 8 y 15 dígitos');
