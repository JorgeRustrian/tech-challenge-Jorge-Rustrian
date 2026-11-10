import { useId, type ComponentProps, type ReactNode } from 'react';
import css from './Campos.module.css';

interface Rotulos {
  etiqueta: string;
  error?: string;
  ayuda?: string;
}

function Envoltura({ id, etiqueta, error, ayuda, children }: Rotulos & { id: string; children: ReactNode }) {
  return (
    <div className={css.campo}>
      <label htmlFor={id} className={css.etiqueta}>
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p id={`${id}-nota`} className={css.error}>
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-nota`} className={css.ayuda}>
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

function atributosControl(id: string, { error, ayuda }: Rotulos) {
  return {
    id,
    className: css.control,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || ayuda ? `${id}-nota` : undefined,
  };
}

export function Entrada({ etiqueta, error, ayuda, id, ...props }: Rotulos & ComponentProps<'input'>) {
  const auto = useId();
  const idCampo = id ?? auto;
  return (
    <Envoltura id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <input {...atributosControl(idCampo, { etiqueta, error, ayuda })} {...props} />
    </Envoltura>
  );
}

export function Seleccion({ etiqueta, error, ayuda, id, children, ...props }: Rotulos & ComponentProps<'select'>) {
  const auto = useId();
  const idCampo = id ?? auto;
  return (
    <Envoltura id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <select {...atributosControl(idCampo, { etiqueta, error, ayuda })} {...props}>
        {children}
      </select>
    </Envoltura>
  );
}

export function AreaTexto({ etiqueta, error, ayuda, id, ...props }: Rotulos & ComponentProps<'textarea'>) {
  const auto = useId();
  const idCampo = id ?? auto;
  return (
    <Envoltura id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <textarea {...atributosControl(idCampo, { etiqueta, error, ayuda })} {...props} />
    </Envoltura>
  );
}

export function Casilla({ etiqueta, ...props }: { etiqueta: string } & Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <label className={css.casilla}>
      <input type="checkbox" {...props} />
      {etiqueta}
    </label>
  );
}
