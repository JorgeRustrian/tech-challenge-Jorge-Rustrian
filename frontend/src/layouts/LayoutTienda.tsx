import { useRef, type FormEvent } from 'react';
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router';
import { esPersonal } from '../auth/roles';
import { useSesion } from '../auth/sesion';
import { IconoBolsa, IconoBuscar } from '../componentes/Iconos';
import { useCarrito, usePuedeComprar } from '../hooks/useCarrito';
import css from './LayoutTienda.module.css';

function MenuCuenta() {
  const { usuario, salir } = useSesion();
  const navegar = useNavigate();
  const menu = useRef<HTMLDetailsElement>(null);

  if (!usuario) {
    return (
      <Link to="/entrar" className={css.enlaceCuenta}>
        Entrar
      </Link>
    );
  }

  const cerrarMenu = () => menu.current?.removeAttribute('open');

  async function cerrarSesion() {
    cerrarMenu();
    navegar('/');
    await salir();
  }

  return (
    <details ref={menu} className={css.menuCuenta}>
      <summary className={css.enlaceCuenta}>{usuario.nombres.split(' ')[0]}</summary>
      <div className={css.desplegable}>
        <p className={css.correo}>{usuario.correo}</p>
        {esPersonal(usuario.rol) ? (
          <Link to="/panel" onClick={cerrarMenu}>
            Ir al panel
          </Link>
        ) : (
          <>
            <Link to="/cuenta/pedidos" onClick={cerrarMenu}>
              Mis pedidos
            </Link>
            <Link to="/cuenta/direcciones" onClick={cerrarMenu}>
              Direcciones
            </Link>
          </>
        )}
        <button type="button" onClick={cerrarSesion}>
          Salir
        </button>
      </div>
    </details>
  );
}

export function LayoutTienda() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const puedeComprar = usePuedeComprar();
  const carrito = useCarrito();
  const articulos = carrito.data?.resumen.cantidadArticulos ?? 0;

  function buscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const texto = String(new FormData(e.currentTarget).get('texto') ?? '').trim();
    navegar(texto ? `/?texto=${encodeURIComponent(texto)}` : '/');
  }

  return (
    <div className={css.pagina}>
      <header className={css.encabezado}>
        <div className={css.barra}>
          <Link to="/" className={css.marca}>
            ShopCart
          </Link>
          <form className={css.buscar} role="search" onSubmit={buscar}>
            <IconoBuscar className={css.lupa} />
            <input
              key={params.get('texto') ?? ''}
              name="texto"
              type="search"
              defaultValue={params.get('texto') ?? ''}
              placeholder="Buscar camisas, tenis, mochilas…"
              aria-label="Buscar productos"
            />
          </form>
          <nav className={css.acciones} aria-label="Cuenta">
            <MenuCuenta />
            {puedeComprar && (
              <Link
                to="/carrito"
                className={css.carrito}
                aria-label={articulos ? `Carrito, ${articulos} ${articulos === 1 ? 'artículo' : 'artículos'}` : 'Carrito'}
              >
                <IconoBolsa />
                <span aria-hidden="true">Carrito</span>
                {articulos > 0 && (
                  <span className={`${css.cuenta} cifras`} aria-hidden="true">
                    {articulos > 99 ? '99+' : articulos}
                  </span>
                )}
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className={css.contenido}>
        <Outlet />
      </main>

      <footer className={css.pie}>
        <div className={css.pieInterno}>
          <p className={css.marcaPie}>ShopCart</p>
          <p>Ropa, calzado y accesorios. Precios en quetzales con IVA incluido.</p>
          <p className={css.derechos}>© 2026 ShopCart</p>
        </div>
      </footer>
    </div>
  );
}
