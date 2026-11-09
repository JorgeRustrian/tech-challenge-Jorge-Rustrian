import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { inicioSegunRol, PERSONAL } from './auth/roles';
import { Cargando } from './componentes/Estados';
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
import { Bitacora } from './paginas/panel/bitacora/Bitacora';
import { Categorias } from './paginas/panel/catalogo/Categorias';
import { EditarProducto } from './paginas/panel/catalogo/EditarProducto';
import { Productos } from './paginas/panel/catalogo/Productos';
import { Cupones } from './paginas/panel/cupones/Cupones';
import { Inventario } from './paginas/panel/inventario/Inventario';
import { Kardex } from './paginas/panel/inventario/Kardex';
import { DetallePedidoPanel } from './paginas/panel/pedidos/DetallePedidoPanel';
import { PedidosPanel } from './paginas/panel/pedidos/PedidosPanel';
import { Usuarios } from './paginas/panel/usuarios/Usuarios';

// Recharts solo se descarga cuando alguien entra al dashboard.
const Dashboard = lazy(() => import('./paginas/panel/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })));

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
          { path: 'pedidos', element: <PedidosPanel /> },
          { path: 'pedidos/:id', element: <DetallePedidoPanel /> },
          { path: 'inventario', element: <Inventario /> },
          { path: 'inventario/:id', element: <Kardex /> },
          { path: 'productos', element: <Productos /> },
          { path: 'productos/:id', element: <EditarProducto /> },
          { path: 'categorias', element: <Categorias /> },
          {
            element: <RutaProtegida roles={['ADMIN']} />,
            children: [
              { path: 'productos/nuevo', element: <EditarProducto /> },
              {
                path: 'dashboard',
                element: (
                  <Suspense fallback={<Cargando texto="Cargando dashboard" />}>
                    <Dashboard />
                  </Suspense>
                ),
              },
              { path: 'cupones', element: <Cupones /> },
              { path: 'usuarios', element: <Usuarios /> },
              { path: 'bitacora', element: <Bitacora /> },
            ],
          },
          { path: '*', element: <NoEncontrada /> },
        ],
      },
    ],
  },
]);
