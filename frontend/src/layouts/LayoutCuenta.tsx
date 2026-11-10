import { NavLink, Outlet } from 'react-router';
import css from './LayoutCuenta.module.css';

export function LayoutCuenta() {
  return (
    <div className={css.cuenta}>
      <nav className={css.pestanas} aria-label="Mi cuenta">
        <NavLink to="/cuenta/pedidos">Mis pedidos</NavLink>
        <NavLink to="/cuenta/direcciones">Direcciones</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
