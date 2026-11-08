import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import css from './Boton.module.css';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

interface Apariencia {
  variante?: Variante;
  chico?: boolean;
}

function clases({ variante = 'primario', chico }: Apariencia, extra?: string): string {
  return [css.boton, css[variante], chico && css.chico, extra].filter(Boolean).join(' ');
}

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Apariencia {
  cargando?: boolean;
}

export function Boton({ variante, chico, cargando, disabled, className, children, type = 'button', ...props }: BotonProps) {
  return (
    <button
      type={type}
      className={clases({ variante, chico }, className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando && <span className={css.giro} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function BotonEnlace({ variante, chico, className, ...props }: LinkProps & Apariencia) {
  return <Link className={clases({ variante, chico }, className)} {...props} />;
}
