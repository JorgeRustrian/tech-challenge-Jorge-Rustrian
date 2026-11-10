import { useEffect, useState } from 'react';

// Para búsquedas mientras se escribe: la API recibe el texto cuando el usuario hace una pausa.
export function useDemorado<T>(valor: T, ms = 350): T {
  const [demorado, setDemorado] = useState(valor);

  useEffect(() => {
    const espera = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);

  return demorado;
}
