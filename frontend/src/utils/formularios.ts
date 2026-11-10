import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ErrorApi } from '../api/cliente';

// Un 400 de la API trae { campo, mensaje } por cada dato inválido: se muestran junto a su campo.
// Devuelve true si el error quedó repartido en los campos y no hace falta un aviso general.
export function erroresEnCampos<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, campos: readonly Path<T>[]): boolean {
  if (!(error instanceof ErrorApi) || error.status !== 400 || error.detalles.length === 0) return false;

  let todos = true;
  for (const detalle of error.detalles) {
    const campo = campos.find((c) => c === detalle.campo);
    if (campo) setError(campo, { message: detalle.mensaje });
    else todos = false;
  }
  return todos;
}
