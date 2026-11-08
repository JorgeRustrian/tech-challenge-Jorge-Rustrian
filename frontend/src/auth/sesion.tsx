import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as auth from '../api/auth';
import { escucharSesion, renovarSesion } from '../api/cliente';
import type { Usuario } from '../api/tipos';

interface ValorSesion {
  usuario: Usuario | null;
  // false mientras se intenta recuperar la sesión al abrir la página.
  lista: boolean;
  entrar: (datos: auth.DatosLogin) => Promise<Usuario>;
  registrarse: (datos: auth.DatosRegistro) => Promise<Usuario>;
  salir: () => Promise<void>;
}

const SesionContext = createContext<ValorSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    let vigente = true;
    renovarSesion()
      .then((sesion) => vigente && setUsuario(sesion?.usuario ?? null))
      .catch(() => vigente && setUsuario(null))
      .finally(() => vigente && setLista(true));
    return () => {
      vigente = false;
    };
  }, []);

  // Si la renovación falla a media navegación, se limpia lo que haya en caché de esa sesión.
  useEffect(
    () =>
      escucharSesion((nuevo) => {
        setUsuario(nuevo);
        if (!nuevo) queryClient.clear();
      }),
    [queryClient],
  );

  async function entrar(datos: auth.DatosLogin): Promise<Usuario> {
    const u = await auth.iniciarSesion(datos);
    queryClient.clear();
    setUsuario(u);
    return u;
  }

  async function registrarse(datos: auth.DatosRegistro): Promise<Usuario> {
    const u = await auth.registrarse(datos);
    queryClient.clear();
    setUsuario(u);
    return u;
  }

  async function salir(): Promise<void> {
    try {
      await auth.cerrarSesion();
    } finally {
      setUsuario(null);
      queryClient.clear();
    }
  }

  return (
    <SesionContext.Provider value={{ usuario, lista, entrar, registrarse, salir }}>{children}</SesionContext.Provider>
  );
}

export function useSesion(): ValorSesion {
  const valor = useContext(SesionContext);
  if (!valor) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return valor;
}
