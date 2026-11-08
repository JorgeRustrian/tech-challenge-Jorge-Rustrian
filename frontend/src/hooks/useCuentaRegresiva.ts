import { useEffect, useState } from 'react';

// Segundos que faltan, contados desde que llegó la respuesta (`desde`, en ms). Se usa la duración
// que manda la API y no su hora de vencimiento, así no importa si el reloj del equipo está desfasado.
export function useCuentaRegresiva(segundos: number | undefined, desde: number): number | undefined {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (segundos === undefined) return;
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [segundos, desde]);

  if (segundos === undefined) return undefined;
  return Math.max(0, Math.ceil((desde + segundos * 1000 - Math.max(ahora, desde)) / 1000));
}
