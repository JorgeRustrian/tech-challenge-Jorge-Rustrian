import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { inicioSegunRol, PERSONAL } from './auth/roles';
import { RutaProtegida } from './auth/RutaProtegida';
import { useSesion } from './auth/sesion';
import { LayoutCuenta } from './layouts/LayoutCuenta';
import { LayoutPanel } from './layouts/LayoutPanel';
import { LayoutTienda } from './layouts/LayoutTienda';
import { Checkout } from './paginas/compra/Checkout';
import { DetallePedido } from './paginas/cuenta/DetallePedido';
import { Direcciones } from './paginas/cuenta/Direcciones';
import { Entrar } from './paginas/cuenta/Entrar';
import { MisPedidos } from './paginas/cuenta/MisPedidos';
import { Registro } from './paginas/cuenta/Registro';
import { ErrorRuta } from './paginas/ErrorRuta';
import { NoEncontrada } from './paginas/NoEncontrada';
import { Carrito } from './paginas/tienda/Carrito';
import { Catalogo } from './paginas/tienda/Catalogo';
import { Producto } from './paginas/tienda/Producto';

// El panel solo lo usa el personal: sus páginas (y Recharts) se descargan aparte para que la tienda cargue liviana.
// El Suspense que las espera está en LayoutPanel.
function diferida<M>(cargar: () => Promise<M>, nombre: keyof M) {
  return lazy(() => cargar().then((m) => ({ default: m[nombre] as ComponentType })));
}

const Dashboard = diferida(() => import('./paginas/panel/dashboard/Dashboard'), 'Dashboard');
const PedidosPanel = diferida(() => import('./paginas/panel/pedidos/PedidosPanel'), 'PedidosPanel');
const DetallePedidoPanel = diferida(() => import('./paginas/panel/pedidos/DetallePedidoPanel'), 'DetallePedidoPanel');
const Inventario = diferida(() => import('./paginas/panel/inventario/Inventario'), 'Inventario');
const Kardex = diferida(() => import('./paginas/panel/inventario/Kardex'), 'Kardex');
const Productos = diferida(() => import('./paginas/panel/catalogo/Productos'), 'Productos');
const EditarProducto = diferida(() => import('./paginas/panel/catalogo/EditarProducto'), 'EditarProducto');
const Categorias = diferida(() => import('./paginas/panel/catalogo/Categorias'), 'Categorias');
const Cupones = diferida(() => import('./paginas/panel/cupones/Cupones'), 'Cupones');
const Usuarios = diferida(() => import('./paginas/panel/usuarios/Usuarios'), 'Usuarios');
const Bitacora = diferida(() => import('./paginas/panel/bitacora/Bitacora'), 'Bitacora');

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
              { path: 'dashboard', element: <Dashboard /> },
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
