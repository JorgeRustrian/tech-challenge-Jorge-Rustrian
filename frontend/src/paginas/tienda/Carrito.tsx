import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  aplicarCupon,
  cambiarCantidad,
  quitarCupon,
  quitarDelCarrito,
  vaciarCarrito,
  type Carrito as DatosCarrito,
  type ItemCarrito,
} from '../../api/carrito';
import { ErrorApi } from '../../api/cliente';
import { useSesion } from '../../auth/sesion';
import { useAvisos } from '../../componentes/Avisos';
import { Boton, BotonEnlace } from '../../componentes/Boton';
import { Cantidad } from '../../componentes/Cantidad';
import { Cargando, ErrorVista, mensajeDeError, Vacio } from '../../componentes/Estados';
import { ImagenProducto } from '../../componentes/ImagenProducto';
import { Confirmar } from '../../componentes/Modal';
import { useAccionCarrito, useCarrito, usePuedeComprar } from '../../hooks/useCarrito';
import { useTitulo } from '../../hooks/useTitulo';
import { formatoMoneda } from '../../utils/formato';
import css from './Carrito.module.css';

function Linea({ item }: { item: ItemCarrito }) {
  const avisar = useAvisos();
  const cambiar = useAccionCarrito(cambiarCantidad);
  const quitar = useAccionCarrito(quitarDelCarrito);
  const ocupada = cambiar.isPending || quitar.isPending;
  const detalle = [item.talla && `Talla ${item.talla}`, item.color].filter(Boolean).join(' · ');
  // Si pide más de lo que hay, se puede bajar la cantidad; si está agotado o se retiró, solo quitar.
  const ajustable = item.aviso !== null && item.existenciaDisponible > 0 && item.cantidad > item.existenciaDisponible;
  const bloqueada = item.aviso !== null && !ajustable;

  function fijar(cantidad: number) {
    if (cantidad < 1) return;
    cambiar.mutate([item.idVariante, cantidad]);
  }

  function quitarLinea() {
    quitar.mutate([item.idVariante], {
      onSuccess: () => avisar('exito', `Se quitó «${item.producto}» del carrito.`),
    });
  }

  const error = cambiar.error ?? quitar.error;

  return (
    <li className={`${css.linea} ${ocupada ? css.ocupada : ''}`} aria-busy={ocupada || undefined}>
      <Link to={`/producto/${item.idProducto}`} className={css.foto} tabIndex={-1} aria-hidden="true">
        <ImagenProducto url={item.imagen} alt="" />
      </Link>

      <div className={css.datos}>
        <Link to={`/producto/${item.idProducto}`} className={css.nombre}>
          {item.producto}
        </Link>
        <p className={css.detalle}>
          {detalle && <span>{detalle}</span>}
          <span className="cifras">{item.sku}</span>
        </p>
        <p className={`${css.unitario} cifras`}>{formatoMoneda(item.precioUnitario)} c/u</p>

        {item.aviso && (
          <p className={css.aviso}>
            {item.aviso}{' '}
            {ajustable && (
              <button type="button" onClick={() => fijar(item.existenciaDisponible)} disabled={ocupada}>
                Dejar {item.existenciaDisponible}
              </button>
            )}
          </p>
        )}
        {error && <p className={css.errorLinea}>{mensajeDeError(error)}</p>}
      </div>

      <div className={css.controles}>
        <Cantidad
          valor={item.cantidad}
          max={Math.max(item.cantidad, item.existenciaDisponible)}
          alCambiar={fijar}
          etiqueta={`Cantidad de ${item.producto}`}
          deshabilitado={ocupada || bloqueada}
        />
        <button type="button" className={css.quitar} onClick={quitarLinea} disabled={ocupada}>
          Quitar
        </button>
      </div>

      <div className={`${css.importe} cifras`}>
        {item.descuento > 0 && <s>{formatoMoneda(item.subtotal)}</s>}
        <strong>{formatoMoneda(item.total)}</strong>
      </div>
    </li>
  );
}

function Cupon({ carrito }: { carrito: DatosCarrito }) {
  const aplicar = useAccionCarrito(aplicarCupon);
  const quitar = useAccionCarrito(quitarCupon);
  const [codigo, setCodigo] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const limpio = codigo.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(limpio)) {
      setErrorLocal('Revise el código: son de 3 a 30 letras, números o guiones.');
      return;
    }
    setErrorLocal(null);
    aplicar.mutate([limpio], { onSuccess: () => setCodigo('') });
  }

  if (carrito.cupon) {
    const { cupon } = carrito;
    return (
      <div className={css.cupon}>
        <div className={`${css.cuponAplicado} ${cupon.valido ? '' : css.cuponInvalido}`}>
          <div>
            <p className={css.codigo}>{cupon.codigo}</p>
            {cupon.descripcion && <p className={css.cuponDescripcion}>{cupon.descripcion}</p>}
          </div>
          <Boton variante="fantasma" chico onClick={() => quitar.mutate([])} cargando={quitar.isPending}>
            Quitar
          </Boton>
        </div>
        {!cupon.valido && cupon.mensaje && (
          <p className={css.errorCupon}>Este cupón ya no aplica: {cupon.mensaje}</p>
        )}
        {quitar.error && <p className={css.errorCupon}>{mensajeDeError(quitar.error)}</p>}
      </div>
    );
  }

  const errorApi = aplicar.error;
  const mensajeApi =
    errorApi instanceof ErrorApi && errorApi.status === 400 && errorApi.detalles[0]
      ? errorApi.detalles[0].mensaje
      : errorApi && mensajeDeError(errorApi);
  const mensaje = errorLocal ?? mensajeApi;

  return (
    <form className={css.cupon} onSubmit={enviar} noValidate>
      <label htmlFor="codigo-cupon" className={css.etiquetaCupon}>
        Cupón de descuento
      </label>
      <div className={css.filaCupon}>
        <input
          id="codigo-cupon"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={mensaje ? true : undefined}
          aria-describedby={mensaje ? 'error-cupon' : undefined}
        />
        <Boton type="submit" variante="secundario" cargando={aplicar.isPending}>
          Aplicar
        </Boton>
      </div>
      {mensaje && (
        <p id="error-cupon" className={css.errorCupon} role="alert">
          {mensaje}
        </p>
      )}
    </form>
  );
}

function Resumen({ carrito }: { carrito: DatosCarrito }) {
  const { usuario } = useSesion();
  const { resumen } = carrito;
  const bloqueado = carrito.items.some((i) => i.aviso !== null);

  return (
    <aside className={css.resumen} aria-label="Resumen del pedido">
      <h2>Resumen</h2>
      <dl className="cifras">
        <div>
          <dt>
            Subtotal ({resumen.cantidadArticulos} {resumen.cantidadArticulos === 1 ? 'artículo' : 'artículos'})
          </dt>
          <dd>{formatoMoneda(resumen.subtotal)}</dd>
        </div>
        {resumen.descuento > 0 && (
          <div className={css.descuento}>
            <dt>Descuento{carrito.cupon && ` (${carrito.cupon.codigo})`}</dt>
            <dd>−{formatoMoneda(resumen.descuento)}</dd>
          </div>
        )}
        <div className={css.total}>
          <dt>Total</dt>
          <dd>{formatoMoneda(resumen.total)}</dd>
        </div>
      </dl>
      <p className={`${css.iva} cifras`}>Incluye IVA por {formatoMoneda(resumen.ivaIncluido)}</p>

      <Cupon carrito={carrito} />

      <div className={css.pagar}>
        {bloqueado ? (
          <>
            <Boton disabled className={css.botonPagar}>
              Continuar con la compra
            </Boton>
            <p className={css.notaPagar}>Revise los productos marcados antes de continuar.</p>
          </>
        ) : usuario ? (
          <BotonEnlace to="/checkout" className={css.botonPagar}>
            Continuar con la compra
          </BotonEnlace>
        ) : (
          <>
            <BotonEnlace to="/entrar" state={{ desde: '/checkout' }} className={css.botonPagar}>
              Entrar para pagar
            </BotonEnlace>
            <p className={css.notaPagar}>
              Su carrito se conserva al entrar. ¿Es nuevo?{' '}
              <Link to="/registro" state={{ desde: '/checkout' }}>
                Cree una cuenta
              </Link>
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

export function Carrito() {
  useTitulo('Carrito');
  const puedeComprar = usePuedeComprar();
  const carrito = useCarrito();
  const vaciar = useAccionCarrito(vaciarCarrito);
  const avisar = useAvisos();
  const [confirmando, setConfirmando] = useState(false);

  if (!puedeComprar) {
    return (
      <Vacio
        titulo="El carrito es solo para clientes"
        texto="Con una cuenta de personal puede ver la tienda, pero no comprar."
        accion={
          <BotonEnlace to="/panel" variante="secundario">
            Ir al panel
          </BotonEnlace>
        }
      />
    );
  }
  if (carrito.isPending) return <Cargando texto="Cargando su carrito" />;
  if (carrito.error) return <ErrorVista error={carrito.error} alReintentar={() => void carrito.refetch()} />;

  const datos = carrito.data;
  if (datos.items.length === 0) {
    return (
      <Vacio
        titulo="Su carrito está vacío"
        texto="Cuando agregue productos, los verá aquí."
        accion={<BotonEnlace to="/">Ver el catálogo</BotonEnlace>}
      />
    );
  }

  return (
    <div className={css.carrito}>
      <header className={css.cabecera}>
        <h1>Carrito</h1>
        <Link to="/">Seguir comprando</Link>
      </header>

      <div className={css.cuerpo}>
        <section aria-label="Productos en el carrito">
          <ul className={css.lineas}>
            {datos.items.map((item) => (
              <Linea key={item.idVariante} item={item} />
            ))}
          </ul>
          <Boton variante="fantasma" chico onClick={() => setConfirmando(true)}>
            Vaciar carrito
          </Boton>
        </section>

        <Resumen carrito={datos} />
      </div>

      <Confirmar
        abierto={confirmando}
        titulo="¿Vaciar el carrito?"
        textoConfirmar="Vaciar carrito"
        peligro
        cargando={vaciar.isPending}
        alCancelar={() => setConfirmando(false)}
        alConfirmar={() =>
          vaciar.mutate([], {
            onSuccess: () => {
              setConfirmando(false);
              avisar('exito', 'Se vació el carrito.');
            },
            onError: (err) => {
              setConfirmando(false);
              avisar('error', mensajeDeError(err));
            },
          })
        }
      >
        <p>
          {datos.items.length === 1 ? 'Se quitará el producto' : `Se quitarán los ${datos.items.length} productos`} del
          carrito.
          {datos.cupon && ` También se quitará el cupón ${datos.cupon.codigo}.`}
        </p>
      </Confirmar>
    </div>
  );
}
