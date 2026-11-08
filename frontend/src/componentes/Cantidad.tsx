import { useState, type KeyboardEvent } from 'react';
import css from './Cantidad.module.css';

interface Props {
  valor: number;
  max: number;
  alCambiar: (cantidad: number) => void;
  etiqueta?: string;
  deshabilitado?: boolean;
}

// Los botones cambian de inmediato; lo que se escribe se confirma al salir del campo o con Enter.
export function Cantidad({ valor, max, alCambiar, etiqueta = 'Cantidad', deshabilitado }: Props) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const tope = Math.max(1, max);

  function confirmar() {
    if (borrador === null) return;
    const n = Math.round(Number(borrador));
    setBorrador(null);
    if (!Number.isFinite(n) || borrador.trim() === '') return;
    const limitado = Math.min(Math.max(n, 1), tope);
    if (limitado !== valor) alCambiar(limitado);
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmar();
    }
    if (e.key === 'Escape') setBorrador(null);
  }

  return (
    <div className={css.cantidad} role="group" aria-label={etiqueta}>
      <button type="button" onClick={() => alCambiar(valor - 1)} disabled={deshabilitado || valor <= 1} aria-label="Restar uno">
        −
      </button>
      <input
        className="cifras"
        type="text"
        inputMode="numeric"
        aria-label={etiqueta}
        value={borrador ?? String(valor)}
        disabled={deshabilitado}
        onChange={(e) => setBorrador(e.target.value.replace(/\D/g, ''))}
        onBlur={confirmar}
        onKeyDown={alTeclear}
      />
      <button type="button" onClick={() => alCambiar(valor + 1)} disabled={deshabilitado || valor >= tope} aria-label="Sumar uno">
        +
      </button>
    </div>
  );
}
