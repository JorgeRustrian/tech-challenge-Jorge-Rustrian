import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Boton } from './Boton';
import { IconoCerrar } from './Iconos';
import css from './Modal.module.css';

interface ModalProps {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: 'normal' | 'amplio';
}

// <dialog> nativo: el navegador se encarga del foco, de Esc y de bloquear el fondo.
export function Modal({ abierto, alCerrar, titulo, children, pie, ancho = 'normal' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={`${css.modal} ${ancho === 'amplio' ? css.amplio : ''}`}
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      {abierto && (
        <div className={css.contenido}>
          <header className={css.cabecera}>
            <h2 id={idTitulo}>{titulo}</h2>
            <button type="button" className={css.cerrar} onClick={alCerrar} aria-label="Cerrar">
              <IconoCerrar />
            </button>
          </header>
          <div className={css.cuerpo}>{children}</div>
          {pie && <footer className={css.pie}>{pie}</footer>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmarProps {
  abierto: boolean;
  titulo: string;
  children: ReactNode;
  textoConfirmar: string;
  peligro?: boolean;
  cargando?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function Confirmar({ abierto, titulo, children, textoConfirmar, peligro, cargando, alConfirmar, alCancelar }: ConfirmarProps) {
  return (
    <Modal
      abierto={abierto}
      alCerrar={alCancelar}
      titulo={titulo}
      pie={
        <>
          <Boton variante="secundario" onClick={alCancelar} disabled={cargando}>
            Cancelar
          </Boton>
          <Boton variante={peligro ? 'peligro' : 'primario'} onClick={alConfirmar} cargando={cargando}>
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      {children}
    </Modal>
  );
}
