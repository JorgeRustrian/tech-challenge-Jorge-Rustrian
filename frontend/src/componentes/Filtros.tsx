import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useDemorado } from '../hooks/useDemorado';
import { Boton } from './Boton';
import { IconoBuscar } from './Iconos';
import css from './Filtros.module.css';

// Barra de filtros de los listados: los controles se alinean abajo y se acomodan en varias filas.
export function BarraFiltros({ children }: { children: ReactNode }) {
  return <div className={css.barra}>{children}</div>;
}

// La búsqueda se manda cuando el usuario deja de escribir, no en cada tecla.
export function CampoBusqueda({
  etiqueta,
  valor,
  placeholder,
  alCambiar,
}: {
  etiqueta: string;
  valor: string;
  placeholder?: string;
  alCambiar: (texto: string | undefined) => void;
}) {
  const [texto, setTexto] = useState(valor);
  const demorado = useDemorado(texto.trim());

  useEffect(() => {
    if (demorado !== valor) alCambiar(demorado || undefined);
    // Solo reacciona a lo que escribe el usuario, no a cada cambio de la URL.
  }, [demorado]);

  return (
    <label className={`${css.campo} ${css.busqueda}`}>
      <span>{etiqueta}</span>
      <span className={css.conIcono}>
        <IconoBuscar width={15} height={15} />
        <input type="search" value={texto} placeholder={placeholder} onChange={(e) => setTexto(e.target.value)} />
      </span>
    </label>
  );
}

export function CampoSeleccion({
  etiqueta,
  valor,
  opciones,
  alCambiar,
}: {
  etiqueta: string;
  valor: string;
  opciones: { valor: string; etiqueta: string }[];
  alCambiar: (valor: string | undefined) => void;
}) {
  return (
    <label className={css.campo}>
      <span>{etiqueta}</span>
      <select value={valor} onChange={(e) => alCambiar(e.target.value || undefined)}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}

// Desde y hasta se aplican juntos con un botón: así no se dispara una búsqueda con la mitad del rango.
export function FiltroFechas({
  desde,
  hasta,
  alAplicar,
}: {
  desde?: string;
  hasta?: string;
  alAplicar: (rango: { fechaDesde?: string; fechaHasta?: string }) => void;
}) {
  const [valorDesde, setValorDesde] = useState(desde ?? '');
  const [valorHasta, setValorHasta] = useState(hasta ?? '');
  const [error, setError] = useState<string | null>(null);

  function aplicar(e: FormEvent) {
    e.preventDefault();
    if (valorDesde && valorHasta && valorDesde > valorHasta) {
      setError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setError(null);
    alAplicar({ fechaDesde: valorDesde || undefined, fechaHasta: valorHasta || undefined });
  }

  return (
    <form className={css.fechas} onSubmit={aplicar} noValidate>
      <label className={css.campo}>
        <span>Desde</span>
        <input type="date" value={valorDesde} onChange={(e) => setValorDesde(e.target.value)} />
      </label>
      <label className={css.campo}>
        <span>Hasta</span>
        <input type="date" value={valorHasta} onChange={(e) => setValorHasta(e.target.value)} />
      </label>
      <Boton type="submit" variante="secundario" chico>
        Aplicar fechas
      </Boton>
      {error && <p className={css.error}>{error}</p>}
    </form>
  );
}
