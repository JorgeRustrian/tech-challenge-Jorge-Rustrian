import { createBrowserRouter, Navigate } from 'react-router';
import { inicioSegunRol, PERSONAL } from './auth/roles';
import { RutaProtegida } from './auth/RutaProtegida';
import { useSesion } from './auth/sesion';
import { LayoutCuenta } from './layouts/LayoutCuenta';
import { LayoutPanel } from './layouts/LayoutPanel';
import { Checkout } from './paginas/compra/Checkout';
import { DetallePedido } from './paginas/cuenta/DetallePedido';
import { Direcciones } from './paginas/cuenta/Direcciones';
import { MisPedidos } from './paginas/cuenta/MisPedidos';
import { LayoutTienda } from './layouts/LayoutTienda';
import { Entrar } from './paginas/cuenta/Entrar';
import { Registro } from './paginas/cuenta/Registro';
import { Carrito } from './paginas/tienda/Carrito';
import { Catalogo } from './paginas/tienda/Catalogo';
import { Producto } from './paginas/tienda/Producto';
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
      { index: true, element: <Catalogo /> },
      { path: 'producto/:id', element: <Producto /> },
      { path: 'carrito', element: <Carrito /> },
      { path: 'entrar', element: <Entrar /> },
      { path: 'registro', element: <Registro /> },
      {
        element: <RutaProtegida roles={['CLIENTE']} />,
        children: [
          { path: 'checkout', element: <Checkout /> },
          {
            path: 'cuenta',
            element: <LayoutCuenta />,
            children: [
              { index: true, element: <Navigate to="pedidos" replace /> },
              { path: 'pedidos', element: <MisPedidos /> },
              { path: 'pedidos/:id', element: <DetallePedido /> },
              { path: 'direcciones', element: <Direcciones /> },
            ],
          },
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
