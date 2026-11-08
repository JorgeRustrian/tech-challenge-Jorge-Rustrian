import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { CLAVE_CARRITO } from '../../api/carrito';
import { CLAVE_CHECKOUT, iniciarPago, pagar, retomarOIniciarPago, type ResumenCheckout } from '../../api/checkout';
import { ErrorApi } from '../../api/cliente';
import { CLAVE_DIRECCIONES, crearDireccion, lineaDireccion, type DatosDireccion, type Direccion } from '../../api/direcciones';
import { Boton, BotonEnlace } from '../../componentes/Boton';
import { Cargando, ErrorVista, mensajeDeError, Vacio } from '../../componentes/Estados';
import { ImagenProducto } from '../../componentes/ImagenProducto';
import { Modal } from '../../componentes/Modal';
import { useCuentaRegresiva } from '../../hooks/useCuentaRegresiva';
import { useDirecciones } from '../../hooks/useDirecciones';
import { useTitulo } from '../../hooks/useTitulo';
import { formatoMoneda, minutosSegundos } from '../../utils/formato';
import { FormularioDireccion } from '../cuenta/FormularioDireccion';
import css from './Checkout.module.css';

function ElegirDireccion({
  direcciones,
  elegida,
  alElegir,
  alAgregar,
}: {
  direcciones: Direccion[];
  elegida: number | undefined;
  alElegir: (id: number) => void;
  alAgregar: () => void;
}) {
  return (
    <fieldset className={css.direcciones}>
      <legend className="solo-lector">Dirección de entrega</legend>
      {direcciones.map((d) => (
        <label key={d.id} className={`${css.opcion} ${d.id === elegida ? css.elegida : ''}`}>
          <input type="radio" name="direccion" checked={d.id === elegida} onChange={() => alElegir(d.id)} />
          <span>
            <strong>{d.alias}</strong>
            {d.esPredeterminada && <span className={css.etiqueta}>Predeterminada</span>}
            <span className={css.detalle}>
              {d.nombreDestinatario} · Tel. {d.telefono}
            </span>
            <span className={css.detalle}>{lineaDireccion(d)}</span>
          </span>
        </label>
      ))}
      <Boton variante="fantasma" chico onClick={alAgregar} disabled={direcciones.length >= 10}>
        + Agregar otra dirección
      </Boton>
    </fieldset>
  );
}

function Reserva({ restante, alRenovar, renovando }: { restante: number; alRenovar: () => void; renovando: boolean }) {
  if (restante <= 0) {
    return (
      <div className={`${css.reserva} ${css.vencida}`} role="alert">
        <p>
          <strong>Se venció el tiempo de reserva.</strong> Los productos quedaron libres para otros clientes.
        </p>
        <Boton variante="secundario" chico onClick={alRenovar} cargando={renovando}>
          Reservar de nuevo
        </Boton>
      </div>
    );
  }
  return (
    <div className={`${css.reserva} ${restante <= 60 ? css.poca : ''}`}>
      <p>
        Apartamos sus productos por{' '}
        <strong className="cifras" aria-live={restante <= 60 ? 'polite' : 'off'}>
          {minutosSegundos(restante)}
        </strong>
      </p>
      <p className={css.notaReserva}>Los precios quedan fijos mientras dure la reserva.</p>
    </div>
  );
}

function Resumen({ resumen }: { resumen: ResumenCheckout }) {
  const { montos } = resumen;
  return (
    <>
      <ul className={css.lineas}>
        {resumen.lineas.map((l) => (
          <li key={l.idVariante}>
            <ImagenProducto url={l.imagen} alt="" className={css.miniatura} />
            <div>
              <p className={css.producto}>{l.producto}</p>
              <p className={css.detalle}>
                {[l.talla && `Talla ${l.talla}`, l.color].filter(Boolean).join(' · ')}
                {' · '}
                <span className="cifras">
                  {l.cantidad} × {formatoMoneda(l.precioUnitario)}
                </span>
              </p>
            </div>
            <p className="cifras">{formatoMoneda(l.total)}</p>
          </li>
        ))}
      </ul>
      <dl className={`${css.montos} cifras`}>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatoMoneda(montos.subtotal)}</dd>
        </div>
        {montos.descuento > 0 && (
          <div className={css.descuento}>
            <dt>Descuento{resumen.cupon && ` (${resumen.cupon.codigo})`}</dt>
            <dd>−{formatoMoneda(montos.descuento)}</dd>
          </div>
        )}
        <div>
          <dt>Envío</dt>
          <dd>{montos.costoEnvio > 0 ? formatoMoneda(montos.costoEnvio) : 'Gratis'}</dd>
        </div>
        <div className={css.total}>
          <dt>Total a pagar</dt>
          <dd>{formatoMoneda(montos.total)}</dd>
        </div>
      </dl>
      <p className={`${css.iva} cifras`}>Incluye IVA por {formatoMoneda(montos.ivaIncluido)}</p>
    </>
  );
}

// Qué ofrecer según por qué falló el pago.
function ErrorPago({ error, alRenovar }: { error: unknown; alRenovar: () => void }) {
  if (!(error instanceof ErrorApi)) return <p className={css.errorPago}>{mensajeDeError(error)}</p>;
  if (error.status === 0 || error.status >= 500) {
    return (
      <p className={css.errorPago}>
        No pudimos confirmar el pago. Puede reintentarlo con tranquilidad: el sistema no le cobra dos veces.
      </p>
    );
  }
  return (
    <div className={css.errorPago}>
      <p>{error.message}</p>
      {error.status === 409 && (
        <button type="button" onClick={alRenovar}>
          Reservar de nuevo
        </button>
      )}
      {error.status === 422 && <Link to="/carrito">Revisar el carrito</Link>}
    </div>
  );
}

export function Checkout() {
  useTitulo('Pago');
  const queryClient = useQueryClient();
  const navegar = useNavigate();
  const direcciones = useDirecciones();
  const [idElegido, setIdElegido] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  // Una clave por intento de pago; los reintentos de ese mismo intento la repiten.
  const claveIdempotencia = useRef<string | null>(null);

  const checkout = useQuery({
    queryKey: CLAVE_CHECKOUT,
    queryFn: ({ signal }) => retomarOIniciarPago(signal),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const restante = useCuentaRegresiva(checkout.data?.segundosRestantes, checkout.dataUpdatedAt);

  const renovar = useMutation({
    mutationFn: iniciarPago,
    onSuccess: (resumen) => {
      claveIdempotencia.current = null;
      pago.reset();
      queryClient.setQueryData(CLAVE_CHECKOUT, resumen);
    },
  });

  const lista = direcciones.data ?? [];
  const elegida = lista.find((d) => d.id === idElegido) ?? lista.find((d) => d.esPredeterminada) ?? lista[0];

  const pago = useMutation({
    mutationFn: (idDireccion: number) => {
      claveIdempotencia.current ??= crypto.randomUUID();
      return pagar(idDireccion, claveIdempotencia.current);
    },
    onSuccess: (pedido) => {
      queryClient.setQueryData(['pedido', pedido.id], pedido);
      void queryClient.invalidateQueries({ queryKey: CLAVE_CARRITO });
      void queryClient.invalidateQueries({ queryKey: ['mis-pedidos'] });
      navegar(`/cuenta/pedidos/${pedido.id}`, { replace: true, state: { recienCreado: true } });
    },
    onError: (err) => {
      if (err instanceof ErrorApi && err.status === 404) void queryClient.invalidateQueries({ queryKey: CLAVE_DIRECCIONES });
    },
  });

  async function guardarDireccion(datos: DatosDireccion) {
    const nueva = await crearDireccion(datos);
    await queryClient.invalidateQueries({ queryKey: CLAVE_DIRECCIONES });
    setIdElegido(nueva.id);
    setAgregando(false);
  }

  if (checkout.isPending || direcciones.isPending) return <Cargando texto="Apartando sus productos" />;

  if (checkout.error) {
    const e = checkout.error;
    if (e instanceof ErrorApi && e.status === 422 && /vac/i.test(e.message)) {
      return (
        <Vacio
          titulo="No hay productos para pagar"
          texto="Si acaba de hacer un pago, su pedido ya aparece en Mis pedidos."
          accion={
            <div className={css.accionesVacio}>
              <BotonEnlace to="/cuenta/pedidos" variante="secundario">
                Mis pedidos
              </BotonEnlace>
              <BotonEnlace to="/">Ver el catálogo</BotonEnlace>
            </div>
          }
        />
      );
    }
    if (e instanceof ErrorApi && (e.status === 409 || e.status === 422)) {
      return (
        <Vacio
          titulo="No pudimos apartar sus productos"
          texto={e.message}
          accion={<BotonEnlace to="/carrito">Volver al carrito</BotonEnlace>}
        />
      );
    }
    return <ErrorVista error={e} alReintentar={() => void checkout.refetch()} />;
  }
  if (direcciones.error) return <ErrorVista error={direcciones.error} alReintentar={() => void direcciones.refetch()} />;

  const resumen = checkout.data;
  const vencida = restante !== undefined && restante <= 0;
  const cuponInvalido = resumen.cupon && !resumen.cupon.valido;
  const puedePagar = !!elegida && !vencida && !cuponInvalido && !pago.isPending;

  return (
    <div className={css.checkout}>
      <header className={css.cabecera}>
        <Link to="/carrito" className={css.volver}>
          ← Volver al carrito
        </Link>
        <h1>Pago</h1>
      </header>

      <div className={css.cuerpo}>
        <div className={css.pasos}>
          <section className={css.paso} aria-labelledby="paso-entrega">
            <h2 id="paso-entrega">
              <span className={css.numero}>1</span> Dirección de entrega
            </h2>
            {lista.length === 0 ? (
              <>
                <p className={css.ayuda}>Todavía no tiene direcciones guardadas. Agregue una para recibir este pedido.</p>
                <FormularioDireccion textoGuardar="Guardar y usar esta dirección" alGuardar={guardarDireccion} />
              </>
            ) : (
              <ElegirDireccion
                direcciones={lista}
                elegida={elegida?.id}
                alElegir={setIdElegido}
                alAgregar={() => setAgregando(true)}
              />
            )}
          </section>

          <section className={css.paso} aria-labelledby="paso-pago">
            <h2 id="paso-pago">
              <span className={css.numero}>2</span> Pago
            </h2>
            <p className={css.ayuda}>
              Pago simulado: al confirmar se registra el pedido con una referencia de pago y no se hace ningún cargo real.
            </p>
          </section>
        </div>

        <aside className={css.resumen} aria-label="Resumen del pedido">
          {restante !== undefined && <Reserva restante={restante} alRenovar={() => renovar.mutate()} renovando={renovar.isPending} />}
          {renovar.error && <p className={css.errorPago}>{mensajeDeError(renovar.error)}</p>}
          <Resumen resumen={resumen} />

          {cuponInvalido && (
            <p className={css.errorPago}>
              El cupón {resumen.cupon?.codigo} ya no aplica: {resumen.cupon?.mensaje} <Link to="/carrito">Quítelo en el carrito</Link>{' '}
              para continuar.
            </p>
          )}
          {pago.error && <ErrorPago error={pago.error} alRenovar={() => renovar.mutate()} />}

          <Boton className={css.pagar} disabled={!puedePagar} cargando={pago.isPending} onClick={() => elegida && pago.mutate(elegida.id)}>
            {pago.isPending ? 'Procesando pago…' : pago.error ? 'Reintentar pago' : `Pagar ${formatoMoneda(resumen.montos.total)}`}
          </Boton>
          {elegida && <p className={css.entregaEn}>Se entrega en: {elegida.alias}, {lineaDireccion(elegida)}</p>}
        </aside>
      </div>

      <Modal abierto={agregando} alCerrar={() => setAgregando(false)} titulo="Nueva dirección" ancho="amplio">
        {agregando && (
          <FormularioDireccion
            preguntarPredeterminada
            textoGuardar="Guardar y usar esta dirección"
            alGuardar={guardarDireccion}
            alCancelar={() => setAgregando(false)}
          />
        )}
      </Modal>
    </div>
  );
}
