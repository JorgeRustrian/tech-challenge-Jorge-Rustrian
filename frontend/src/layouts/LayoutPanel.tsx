import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { ETIQUETA_ROL } from '../auth/roles';
import { useSesion } from '../auth/sesion';
import { Cargando } from '../componentes/Estados';
import { IconoCerrar, IconoMenu } from '../componentes/Iconos';
import { seccionesPara } from './menuPanel';
import css from './LayoutPanel.module.css';

export function LayoutPanel() {
  const { usuario, salir } = useSesion();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // RutaProtegida ya garantizó que hay sesión de Operador o Administrador.
  if (!usuario) return null;

  // Primero se sale de la ruta protegida; si no, RutaProtegida manda a "Entrar".
  async function cerrarSesion() {
    navegar('/');
    await salir();
  }

  return (
    <div className={css.panel}>
      <aside className={`${css.lateral} ${menuAbierto ? css.abierto : ''}`}>
        <div className={css.marca}>
          <Link to="/panel">ShopCart</Link>
          <span>Panel</span>
          <button type="button" className={css.cerrarMenu} onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
            <IconoCerrar />
          </button>
        </div>

        <nav className={css.navegacion} aria-label="Panel">
          {seccionesPara(usuario.rol).map((seccion) => (
            <div key={seccion.titulo} className={css.seccion}>
              <p>{seccion.titulo}</p>
              <ul>
                {seccion.enlaces.map((enlace) => (
                  <li key={enlace.ruta}>
                    <NavLink to={enlace.ruta} onClick={() => setMenuAbierto(false)}>
                      {enlace.etiqueta}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={css.usuario}>
          <p className={css.nombre}>
            {usuario.nombres} {usuario.apellidos}
          </p>
          <p className={css.rol}>{ETIQUETA_ROL[usuario.rol]}</p>
          <div className={css.accionesUsuario}>
            <Link to="/">Ver tienda</Link>
            <button type="button" onClick={cerrarSesion}>
              Salir
            </button>
          </div>
        </div>
      </aside>

      {menuAbierto && <div className={css.velo} onClick={() => setMenuAbierto(false)} />}

      <div className={css.principal}>
        <header className={css.barraMovil}>
          <button type="button" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" aria-expanded={menuAbierto}>
            <IconoMenu />
          </button>
          <span>ShopCart · Panel</span>
        </header>
        <main className={css.contenido}>
          {/* Las páginas del panel se descargan aparte; mientras llega una, el menú sigue visible. */}
          <Suspense fallback={<Cargando />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
