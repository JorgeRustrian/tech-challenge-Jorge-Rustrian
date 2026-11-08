import { createBrowserRouter, Navigate } from 'react-router';
import { inicioSegunRol, PERSONAL } from './auth/roles';
import { RutaProtegida } from './auth/RutaProtegida';
import { useSesion } from './auth/sesion';
import { LayoutPanel } from './layouts/LayoutPanel';
import { LayoutTienda } from './layouts/LayoutTienda';
import { Entrar } from './paginas/cuenta/Entrar';
import { ErrorRuta } from './paginas/ErrorRuta';
import { NoEncontrada } from './paginas/NoEncontrada';
import { Pendiente } from './paginas/Pendiente';

function InicioPanel() {
  const { usuario } = useSesion();
  return <Navigate to={usuario ? inicioSegunRol(usuario.rol) : '/'} replace />;
}

export const router = createBrowserRouter([
  {
    element: <LayoutTienda />,
    errorElement: <ErrorRuta />,
    children: [
      { index: true, element: <Pendiente titulo="Catálogo" /> },
      { path: 'entrar', element: <Entrar /> },
      {
        element: <RutaProtegida roles={['CLIENTE']} />,
        children: [
          { path: 'cuenta/pedidos', element: <Pendiente titulo="Mis pedidos" /> },
          { path: 'cuenta/direcciones', element: <Pendiente titulo="Direcciones" /> },
        ],
      },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
  {
    path: 'panel',
    element: <RutaProtegida roles={PERSONAL} />,
    errorElement: <ErrorRuta />,
    children: [
      {
        element: <LayoutPanel />,
        children: [
          { index: true, element: <InicioPanel /> },
          { path: 'pedidos', element: <Pendiente titulo="Pedidos" /> },
          { path: 'inventario', element: <Pendiente titulo="Inventario" /> },
          { path: 'productos', element: <Pendiente titulo="Productos" /> },
          { path: 'categorias', element: <Pendiente titulo="Categorías" /> },
          {
            element: <RutaProtegida roles={['ADMIN']} />,
            children: [
              { path: 'dashboard', element: <Pendiente titulo="Dashboard" /> },
              { path: 'cupones', element: <Pendiente titulo="Cupones" /> },
              { path: 'usuarios', element: <Pendiente titulo="Usuarios" /> },
              { path: 'bitacora', element: <Pendiente titulo="Bitácora" /> },
            ],
          },
          { path: '*', element: <NoEncontrada /> },
        ],
      },
    ],
  },
]);
