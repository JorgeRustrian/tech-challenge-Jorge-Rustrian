import type { ReactNode } from 'react';
import { ErrorApi } from '../api/cliente';
import { Boton } from './Boton';
import css from './Estados.module.css';

export function Cargando({ texto = 'Cargando' }: { texto?: string }) {
  return (
    <div className={css.estado} role="status">
      <span className={css.giro} aria-hidden="true" />
      <span>{texto}…</span>
    </div>
  );
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className={css.estado}>
      <p className={css.titulo}>{titulo}</p>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}

export function mensajeDeError(error: unknown): string {
  if (!(error instanceof ErrorApi)) return 'Ocurrió un error inesperado.';
  if (error.status === 429 && error.reintentarEn) {
    const minutos = Math.ceil(error.reintentarEn / 60);
    return `Hizo demasiados intentos seguidos. Por seguridad, espere ${minutos === 1 ? '1 minuto' : `${minutos} minutos`} y vuelva a intentar.`;
  }
  return error.message;
}

export function ErrorVista({ error, alReintentar }: { error: unknown; alReintentar?: () => void }) {
  return (
    <div className={`${css.estado} ${css.error}`} role="alert">
      <p className={css.titulo}>No se pudo cargar</p>
      <p>{mensajeDeError(error)}</p>
      {alReintentar && (
        <Boton variante="secundario" chico onClick={alReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

// Error de un formulario o de una acción: va arriba del formulario, no reemplaza la vista.
export function AvisoError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className={css.avisoError} role="alert">
      {mensajeDeError(error)}
    </p>
  );
}
