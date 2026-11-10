import type { SVGProps } from 'react';

function Icono({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconoBolsa(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </Icono>
  );
}

export function IconoBuscar(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icono>
  );
}

export function IconoCerrar(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icono>
  );
}

export function IconoMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <Icono {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icono>
  );
}

export function IconoFlecha({ direccion = 'derecha', ...props }: SVGProps<SVGSVGElement> & { direccion?: 'izquierda' | 'derecha' | 'abajo' }) {
  const giro = { izquierda: 180, derecha: 0, abajo: 90 }[direccion];
  return (
    <Icono {...props} style={{ transform: `rotate(${giro}deg)` }}>
      <path d="m9 5 7 7-7 7" />
    </Icono>
  );
}
