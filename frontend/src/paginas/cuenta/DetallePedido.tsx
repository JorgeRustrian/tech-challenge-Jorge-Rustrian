import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { ErrorApi } from '../../api/cliente';
import { CANCELABLES_POR_CLIENTE, cancelarMiPedido, numeroPedido, obtenerMiPedido, type PedidoDetalle } from '../../api/pedidos';
import { useAvisos } from '../../componentes/Avisos';
import { Boton, BotonEnlace } from '../../componentes/Boton';
import { AreaTexto } from '../../componentes/Campos';
import { AvisoError, Cargando, ErrorVista, Vacio } from '../../componentes/Estados';
import { EstadoPedido, etiquetaEstadoPedido } from '../../componentes/Insignia';
import { Modal } from '../../componentes/Modal';
import { useTitulo } from '../../hooks/useTitulo';
import { formatoFechaHora, formatoMoneda } from '../../utils/formato';
import { NoEncontrada } from '../NoEncontrada';
import css from './DetallePedido.module.css';

function Lineas({ pedido }: { pedido: PedidoDetalle }) {
  return (
    <div className={css.tablaMarco}>
      <table className={css.tabla}>
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col" className={css.num}>
              Cant.
            </th>
            <th scope="col" className={`${css.num} ${css.amplia}`}>
              Precio
            </th>
            <th scope="col" className={`${css.num} ${css.amplia}`}>
              Descuento
            </th>
            <th scope="col" className={css.num}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {pedido.lineas.map((l) => (
            <tr key={l.id}>
              <td>
                <p className={css.producto}>{l.producto}</p>
                <p className={css.secundario}>
                  {[l.talla && `Talla ${l.talla}`, l.color, l.sku].filter(Boolean).join(' · ')}
                </p>
                {/* En pantallas angostas el precio y el descuento van aquí en lugar de en sus columnas. */}
                <p className={`${css.secundario} ${css.angosta} cifras`}>
                  {formatoMoneda(l.precioUnitario)} c/u{l.descuento > 0 && ` · −${formatoMoneda(l.descuento)}`}
                </p>
                {l.cantidadDevuelta > 0 && (
                  <p className={css.devuelta}>
                    {l.cantidadDevuelta === l.cantidad ? 'Devuelto' : `${l.cantidadDevuelta} de ${l.cantidad} devueltas`}
                  </p>
                )}
              </td>
              <td className={css.num}>{l.cantidad}</td>
              <td className={`${css.num} ${css.amplia}`}>{formatoMoneda(l.precioUnitario)}</td>
              <td className={`${css.num} ${css.amplia}`}>{l.descuento > 0 ? `−${formatoMoneda(l.descuento)}` : '—'}</td>
              <td className={css.num}>{formatoMoneda(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Montos({ pedido }: { pedido: PedidoDetalle }) {
  const { montos } = pedido;
  return (
    <dl className={`${css.montos} cifras`}>
      <div>
        <dt>Subtotal</dt>
        <dd>{formatoMoneda(montos.subtotal)}</dd>
      </div>
      {montos.descuento > 0 && (
        <div className={css.descuento}>
          <dt>Descuento{pedido.cupon && ` (${pedido.cupon})`}</dt>
          <dd>−{formatoMoneda(montos.descuento)}</dd>
        </div>
      )}
      <div>
        <dt>Envío</dt>
        <dd>{montos.costoEnvio > 0 ? formatoMoneda(montos.costoEnvio) : 'Gratis'}</dd>
      </div>
      <div className={css.total}>
        <dt>Total pagado</dt>
        <dd>{formatoMoneda(montos.total)}</dd>
      </div>
      <div className={css.iva}>
        <dt>IVA incluido</dt>
        <dd>{formatoMoneda(montos.ivaIncluido)}</dd>
      </div>
      {montos.reembolsado > 0 && (
        <div className={css.reembolso}>
          <dt>Reembolsado</dt>
          <dd>{formatoMoneda(montos.reembolsado)}</dd>
        </div>
      )}
    </dl>
  );
}

function Historial({ pedido }: { pedido: PedidoDetalle }) {
  // La API los entrega en orden; el más reciente se muestra arriba.
  const eventos = [...pedido.historial].reverse();
  return (
    <ol className={css.historial}>
      {eventos.map((h, i) => (
        <li key={`${h.fecha}-${i}`}>
          <p className={css.evento}>{etiquetaEstadoPedido(h.estadoNuevo)}</p>
          <p className={`${css.secundario} cifras`}>
            {formatoFechaHora(h.fecha)} · {h.usuario.nombre}
          </p>
          {h.comentario && <p className={css.comentario}>{h.comentario}</p>}
        </li>
      ))}
    </ol>
  );
}

function Cancelar({ pedido, alCerrar }: { pedido: PedidoDetalle; alCerrar: () => void }) {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [motivo, setMotivo] = useState('');
  const cancelar = useMutation({
    mutationFn: () => cancelarMiPedido(pedido.id, motivo.trim() || null),
    onSuccess: (actualizado) => {
      queryClient.setQueryData(['pedido', pedido.id], actualizado);
      void queryClient.invalidateQueries({ queryKey: ['mis-pedidos'] });
      avisar('exito', `Se canceló el pedido ${numeroPedido(pedido.id)}.`);
      alCerrar();
    },
    onError: (err) => {
      // Si el pedido cambió de estado mientras tanto (por ejemplo, ya se despachó), se muestra el actual.
      if (err instanceof ErrorApi && err.status === 409) void queryClient.invalidateQueries({ queryKey: ['pedido', pedido.id] });
    },
  });

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={`Cancelar el pedido ${numeroPedido(pedido.id)}`}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={cancelar.isPending}>
            No cancelar
          </Boton>
          <Boton variante="peligro" onClick={() => cancelar.mutate()} cargando={cancelar.isPending}>
            Cancelar pedido
          </Boton>
        </>
      }
    >
      <div className={css.formCancelar}>
        <AvisoError error={cancelar.error} />
        <p>El pedido no se enviará. Esta acción no se puede deshacer.</p>
        <AreaTexto
          etiqueta="Motivo (opcional)"
          maxLength={200}
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          ayuda={`${motivo.length} de 200 caracteres`}
        />
      </div>
    </Modal>
  );
}

export function DetallePedido() {
  const { id } = useParams();
  const idPedido = Number(id);
  const valido = Number.isInteger(idPedido) && idPedido > 0;
  const ubicacion = useLocation();
  const recienCreado = (ubicacion.state as { recienCreado?: boolean } | null)?.recienCreado;
  const [cancelando, setCancelando] = useState(false);

  const consulta = useQuery({
    queryKey: ['pedido', idPedido],
    queryFn: ({ signal }) => obtenerMiPedido(idPedido, signal),
    enabled: valido,
  });
  useTitulo(valido ? `Pedido ${numeroPedido(idPedido)}` : undefined);

  if (!valido) return <NoEncontrada />;
  if (consulta.isPending) return <Cargando texto="Cargando pedido" />;
  if (consulta.error) {
    if (consulta.error instanceof ErrorApi && consulta.error.status === 404) {
      return (
        <Vacio
          titulo="No encontramos este pedido"
          texto="Revise el número o búsquelo en su lista de pedidos."
          accion={
            <BotonEnlace to="/cuenta/pedidos" variante="secundario">
              Mis pedidos
            </BotonEnlace>
          }
        />
      );
    }
    return <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;
  }

  const pedido = consulta.data;
  const cancelable = CANCELABLES_POR_CLIENTE.includes(pedido.estado.codigo);

  return (
    <article className={css.pedido}>
      <header className={css.cabecera}>
        <div>
          <Link to="/cuenta/pedidos" className={css.volver}>
            ← Mis pedidos
          </Link>
          <h1>
            Pedido <span className="cifras">{numeroPedido(pedido.id)}</span>
          </h1>
          <p className={`${css.secundario} cifras`}>Realizado el {formatoFechaHora(pedido.fechaCreacion)}</p>
        </div>
        <div className={css.estadoAcciones}>
          <EstadoPedido codigo={pedido.estado.codigo} />
          {cancelable && (
            <Boton variante="secundario" chico onClick={() => setCancelando(true)}>
              Cancelar pedido
            </Boton>
          )}
        </div>
      </header>

      {recienCreado && (
        <div className={css.confirmado} role="status">
          <p>
            <strong>Pedido confirmado.</strong> Recibimos su pago
            {pedido.referenciaPago && (
              <>
                {' '}
                con la referencia <span className="cifras">{pedido.referenciaPago}</span>
              </>
            )}
            . Aquí puede seguir el estado de su envío.
          </p>
        </div>
      )}

      <div className={css.cuerpo}>
        <div className={css.principal}>
          <section>
            <h2>Productos</h2>
            <Lineas pedido={pedido} />
          </section>

          {pedido.devoluciones.length > 0 && (
            <section>
              <h2>Devoluciones</h2>
              <ul className={css.devoluciones}>
                {pedido.devoluciones.map((d) => (
                  <li key={d.id}>
                    <p>
                      <strong className="cifras">{formatoMoneda(d.montoReembolso)}</strong> reembolsados el{' '}
                      <span className="cifras">{formatoFechaHora(d.fecha)}</span>
                    </p>
                    <p className={css.secundario}>
                      {d.lineas.map((l) => `${l.cantidad} × ${l.sku}`).join(', ')} · Motivo: {d.motivo}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2>Seguimiento</h2>
            <Historial pedido={pedido} />
          </section>
        </div>

        <aside className={css.lateral}>
          <section className={css.bloque}>
            <h2>Entrega</h2>
            <p>{pedido.entrega.destinatario}</p>
            <p className={css.secundario}>{pedido.entrega.direccion}</p>
            <p className={`${css.secundario} cifras`}>Tel. {pedido.entrega.telefono}</p>
          </section>
          <section className={css.bloque}>
            <h2>Pago</h2>
            <Montos pedido={pedido} />
            {pedido.referenciaPago && (
              <p className={`${css.referencia} cifras`}>Referencia {pedido.referenciaPago}</p>
            )}
          </section>
        </aside>
      </div>

      {cancelando && <Cancelar pedido={pedido} alCerrar={() => setCancelando(false)} />}
    </article>
  );
}
