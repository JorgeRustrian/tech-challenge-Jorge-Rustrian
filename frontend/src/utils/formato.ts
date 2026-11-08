const ZONA = 'America/Guatemala';

const moneda = new Intl.NumberFormat('es-GT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fecha = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const fechaHora = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// "Q 1,250.00": el símbolo separado, como en los recibos de las tiendas.
export function formatoMoneda(valor: number): string {
  return `Q ${moneda.format(valor)}`;
}

export function formatoFecha(iso: string): string {
  return fecha.format(new Date(iso));
}

export function formatoFechaHora(iso: string): string {
  return fechaHora.format(new Date(iso));
}

// AAAA-MM-DD en hora de Guatemala, el formato que reciben los filtros de fecha de la API.
export function fechaLocalISO(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d);
}

export function minutosSegundos(totalSegundos: number): string {
  const s = Math.max(0, Math.floor(totalSegundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
