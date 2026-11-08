import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as auth from '../api/auth';
import { CLAVE_CARRITO, fusionarCarritoInvitado, type Carrito } from '../api/carrito';
import { escucharSesion, renovarSesion } from '../api/cliente';
import type { Usuario } from '../api/tipos';
import { useAvisos } from '../componentes/Avisos';

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
  const avisar = useAvisos();
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

  // Al cambiar de usuario no debe quedar en pantalla nada del anterior. resetQueries (y no clear)
  // borra los datos y vuelve a pedir lo que está a la vista; con clear esas consultas quedaban colgadas.
  const olvidarDatos = useCallback(() => void queryClient.resetQueries(), [queryClient]);

  // Si la renovación falla a media navegación, la sesión terminó.
  useEffect(
    () =>
      escucharSesion((nuevo) => {
        setUsuario(nuevo);
        if (!nuevo) olvidarDatos();
      }),
    [olvidarDatos],
  );

  // Lo que el cliente eligió como invitado pasa al carrito de su cuenta antes de mostrarle nada.
  async function abrirSesion(u: Usuario): Promise<Usuario> {
    const habiaProductos = (queryClient.getQueryData<Carrito>(CLAVE_CARRITO)?.items.length ?? 0) > 0;
    let fusionado: Carrito | null = null;
    if (u.rol === 'CLIENTE') {
      try {
        fusionado = await fusionarCarritoInvitado();
      } catch {
        // El token sigue guardado: se vuelve a intentar la próxima vez que entre.
      }
    }
    // El personal no tiene carrito: se quita de la caché para que el reinicio no lo vuelva a pedir.
    if (u.rol !== 'CLIENTE') queryClient.removeQueries({ queryKey: CLAVE_CARRITO });
    olvidarDatos();
    if (fusionado) {
      queryClient.setQueryData(CLAVE_CARRITO, fusionado);
      if (habiaProductos) avisar('exito', 'Agregamos a su cuenta los productos que eligió antes de entrar.');
    }
    setUsuario(u);
    return u;
  }

  async function entrar(datos: auth.DatosLogin): Promise<Usuario> {
    return abrirSesion(await auth.iniciarSesion(datos));
  }

  async function registrarse(datos: auth.DatosRegistro): Promise<Usuario> {
    return abrirSesion(await auth.registrarse(datos));
  }

  async function salir(): Promise<void> {
    try {
      await auth.cerrarSesion();
    } finally {
      setUsuario(null);
      olvidarDatos();
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
