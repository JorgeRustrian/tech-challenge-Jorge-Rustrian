import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { ErrorApi } from '../../api/cliente';
import { CANCELABLES_POR_CLIENTE, cancelarMiPedido, numeroPedido, obtenerMiPedido, type PedidoDetalle } from '../../api/pedidos';
import { useAvisos } from '../../componentes/Avisos';
import { Boton, BotonEnlace } from '../../componentes/Boton';
import { AreaTexto } from '../../componentes/Campos';
import { AvisoError, Cargando, ErrorVista, Vacio } from '../../componentes/Estados';
import { EstadoPedido } from '../../componentes/Insignia';
import { Modal } from '../../componentes/Modal';
import { DevolucionesPedido, HistorialPedido, LineasPedido, MontosPedido } from '../../componentes/pedido/PartesPedido';
import { useTitulo } from '../../hooks/useTitulo';
import { formatoFechaHora } from '../../utils/formato';
import { NoEncontrada } from '../NoEncontrada';
import css from './DetallePedido.module.css';

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
    <article>
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
            <LineasPedido pedido={pedido} />
          </section>

          {pedido.devoluciones.length > 0 && (
            <section>
              <h2>Devoluciones</h2>
              <DevolucionesPedido pedido={pedido} />
            </section>
          )}

          <section>
            <h2>Seguimiento</h2>
            <HistorialPedido pedido={pedido} vistaCliente />
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
            <MontosPedido pedido={pedido} />
          </section>
        </aside>
      </div>

      {cancelando && <Cancelar pedido={pedido} alCerrar={() => setCancelando(false)} />}
    </article>
  );
}
