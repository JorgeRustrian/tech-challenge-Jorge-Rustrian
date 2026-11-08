import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import css from './Avisos.module.css';

type TipoAviso = 'exito' | 'error';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

type Avisar = (tipo: TipoAviso, texto: string) => void;

const AvisosContext = createContext<Avisar>(() => {});

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const siguienteId = useRef(1);

  const avisar = useCallback<Avisar>((tipo, texto) => {
    const id = siguienteId.current++;
    setAvisos((actuales) => [...actuales, { id, tipo, texto }]);
    setTimeout(() => setAvisos((actuales) => actuales.filter((a) => a.id !== id)), 4500);
  }, []);

  return (
    <AvisosContext.Provider value={avisar}>
      {children}
      <div className={css.pila} aria-live="polite">
        {avisos.map((a) => (
          <p key={a.id} className={`${css.aviso} ${css[a.tipo]}`}>
            {a.texto}
          </p>
        ))}
      </div>
    </AvisosContext.Provider>
  );
}

export function useAvisos(): Avisar {
  return useContext(AvisosContext);
}
