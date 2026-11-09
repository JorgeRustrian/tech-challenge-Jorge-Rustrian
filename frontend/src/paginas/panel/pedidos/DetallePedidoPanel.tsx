import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ErrorApi } from '../../../api/cliente';
import {
  ADMITEN_DEVOLUCION,
  cambiarEstadoPedido,
  numeroPedido,
  obtenerPedidoPanel,
  reembolsoEstimado,
  registrarDevolucion,
  SIGUIENTES_ESTADOS,
  type PedidoDetalle,
} from '../../../api/pedidos';
import { useAvisos } from '../../../componentes/Avisos';
import { Boton, BotonEnlace } from '../../../componentes/Boton';
import { AreaTexto } from '../../../componentes/Campos';
import { AvisoError, Cargando, ErrorVista, Vacio } from '../../../componentes/Estados';
import { EstadoPedido, etiquetaEstadoPedido } from '../../../componentes/Insignia';
import { Modal } from '../../../componentes/Modal';
import { DevolucionesPedido, HistorialPedido, LineasPedido, MontosPedido } from '../../../componentes/pedido/PartesPedido';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoFechaHora, formatoMoneda } from '../../../utils/formato';
import { NoEncontrada } from '../../NoEncontrada';
import css from './Pedidos.module.css';

const ACCION_ESTADO: Record<string, string> = {
  EN_PREPARACION: 'Pasar a preparación',
  DESPACHADO: 'Marcar como despachado',
  ENTREGADO: 'Marcar como entregado',
  CANCELADO: 'Cancelar pedido',
};

// Cancelar, cambiar de estado o devolver mueve existencias: las vistas de inventario quedan viejas.
function useAlActualizar(id: number) {
  const queryClient = useQueryClient();
  return (pedido: PedidoDetalle) => {
    queryClient.setQueryData(['pedido-panel', id], pedido);
    void queryClient.invalidateQueries({ queryKey: ['panel-pedidos'] });
    void queryClient.invalidateQueries({ queryKey: ['existencias'] });
    void queryClient.invalidateQueries({ queryKey: ['kardex'] });
  };
}

function CambiarEstado({ pedido, estado, alCerrar }: { pedido: PedidoDetalle; estado: string; alCerrar: () => void }) {
  const avisar = useAvisos();
  const queryClient = useQueryClient();
  const alActualizar = useAlActualizar(pedido.id);
  const [comentario, setComentario] = useState('');
  const cancelar = estado === 'CANCELADO';
  const unidades = pedido.lineas.reduce((s, l) => s + l.cantidad, 0);

  const cambio = useMutation({
    mutationFn: () => cambiarEstadoPedido(pedido.id, estado, comentario.trim() || null),
    onSuccess: (actualizado) => {
      alActualizar(actualizado);
      avisar('exito', `${numeroPedido(pedido.id)}: ${etiquetaEstadoPedido(estado)}.`);
      alCerrar();
    },
    onError: (err) => {
      // Otro usuario lo cambió mientras tanto: se recarga para mostrar el estado real.
      if (err instanceof ErrorApi && err.status === 409) void queryClient.invalidateQueries({ queryKey: ['pedido-panel', pedido.id] });
    },
  });

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={`${ACCION_ESTADO[estado]} · ${numeroPedido(pedido.id)}`}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={cambio.isPending}>
            Volver
          </Boton>
          <Boton variante={cancelar ? 'peligro' : 'primario'} onClick={() => cambio.mutate()} cargando={cambio.isPending}>
            {ACCION_ESTADO[estado]}
          </Boton>
        </>
      }
    >
      <div className={css.formulario}>
        <AvisoError error={cambio.error} />
        <p>
          El pedido pasa de <strong>{pedido.estado.nombre}</strong> a <strong>{etiquetaEstadoPedido(estado)}</strong>.
          {cancelar && ` Las ${unidades} unidades vuelven al inventario. No se puede deshacer.`}
        </p>
        <AreaTexto
          etiqueta={cancelar ? 'Motivo (opcional)' : 'Comentario (opcional)'}
          placeholder={estado === 'DESPACHADO' ? 'Guía de envío, transportista…' : undefined}
          maxLength={250}
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          ayuda="Queda en el seguimiento del pedido."
        />
      </div>
    </Modal>
  );
}

function Devolucion({ pedido, alCerrar }: { pedido: PedidoDetalle; alCerrar: () => void }) {
  const avisar = useAvisos();
  const alActualizar = useAlActualizar(pedido.id);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [motivo, setMotivo] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const lineas = pedido.lineas.map((l) => ({ linea: l, pendiente: l.cantidad - l.cantidadDevuelta }));
  const elegidas = lineas
    .map(({ linea }) => ({ idPedidoDetalle: linea.id, cantidad: cantidades[linea.id] ?? 0 }))
    .filter((l) => l.cantidad > 0);
  const totalReembolso = lineas.reduce((s, { linea }) => s + reembolsoEstimado(linea, cantidades[linea.id] ?? 0), 0);

  const devolver = useMutation({
    mutationFn: () => registrarDevolucion(pedido.id, motivo.trim(), elegidas),
    onSuccess: (actualizado) => {
      alActualizar(actualizado);
      const ultima = actualizado.devoluciones.at(-1);
      avisar('exito', `Devolución registrada${ultima ? `: reembolso de ${formatoMoneda(ultima.montoReembolso)}` : ''}.`);
      alCerrar();
    },
  });

  function fijar(id: number, valor: string, pendiente: number) {
    const n = Math.min(Math.max(Math.round(Number(valor) || 0), 0), pendiente);
    setCantidades((c) => ({ ...c, [id]: n }));
  }

  function enviar() {
    if (elegidas.length === 0) return setErrorLocal('Indique cuántas unidades se devuelven de al menos un producto.');
    if (motivo.trim().length < 3) return setErrorLocal('Escriba el motivo de la devolución.');
    setErrorLocal(null);
    devolver.mutate();
  }

  return (
    <Modal
      abierto
      ancho="amplio"
      alCerrar={alCerrar}
      titulo={`Registrar devolución · ${numeroPedido(pedido.id)}`}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={devolver.isPending}>
            Volver
          </Boton>
          <Boton onClick={enviar} cargando={devolver.isPending}>
            Registrar devolución
          </Boton>
        </>
      }
    >
      <div className={css.formulario}>
        {errorLocal ? (
          <p className={css.error} role="alert">
            {errorLocal}
          </p>
        ) : (
          <AvisoError error={devolver.error} />
        )}
        <table className={css.tablaDevolucion}>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col" className={css.num}>
                Vendidas
              </th>
              <th scope="col" className={css.num}>
                Pendientes
              </th>
              <th scope="col" className={css.num}>
                Devolver
              </th>
              <th scope="col" className={css.num}>
                Reembolso
              </th>
            </tr>
          </thead>
          <tbody>
            {lineas.map(({ linea, pendiente }) => (
              <tr key={linea.id} className={pendiente === 0 ? css.agotada : undefined}>
                <td>
                  {linea.producto}
                  <span className={css.secundario}> · {linea.sku}</span>
                </td>
                <td className={css.num}>{linea.cantidad}</td>
                <td className={css.num}>{pendiente}</td>
                <td className={css.num}>
                  <input
                    type="number"
                    min={0}
                    max={pendiente}
                    disabled={pendiente === 0}
                    aria-label={`Unidades de ${linea.sku} a devolver`}
                    value={cantidades[linea.id] ?? 0}
                    onChange={(e) => fijar(linea.id, e.target.value, pendiente)}
                  />
                </td>
                <td className={css.num}>{formatoMoneda(reembolsoEstimado(linea, cantidades[linea.id] ?? 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Reembolso total</td>
              <td className={css.num}>{formatoMoneda(totalReembolso)}</td>
            </tr>
          </tfoot>
        </table>
        <AreaTexto
          etiqueta="Motivo"
          maxLength={250}
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          ayuda="Lo devuelto vuelve al inventario y queda en el kardex como devolución."
        />
      </div>
    </Modal>
  );
}

export function DetallePedidoPanel() {
  const { id } = useParams();
  const idPedido = Number(id);
  const valido = Number.isInteger(idPedido) && idPedido > 0;
  const [estadoNuevo, setEstadoNuevo] = useState<string | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);

  const consulta = useQuery({
    queryKey: ['pedido-panel', idPedido],
    queryFn: ({ signal }) => obtenerPedidoPanel(idPedido, signal),
    enabled: valido,
  });
  useTitulo(valido ? `Pedido ${numeroPedido(idPedido)}` : undefined);

  if (!valido) return <NoEncontrada />;
  if (consulta.isPending) return <Cargando texto="Cargando pedido" />;
  if (consulta.error) {
    if (consulta.error instanceof ErrorApi && consulta.error.status === 404) {
      return (
        <Vacio
          titulo={`El pedido ${numeroPedido(idPedido)} no existe`}
          accion={
            <BotonEnlace to="/panel/pedidos" variante="secundario">
              Ver pedidos
            </BotonEnlace>
          }
        />
      );
    }
    return <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;
  }

  const pedido = consulta.data;
  const siguientes = SIGUIENTES_ESTADOS[pedido.estado.codigo] ?? [];
  const admiteDevolucion = ADMITEN_DEVOLUCION.includes(pedido.estado.codigo);

  return (
    <article>
      <header className={css.cabecera}>
        <div>
          <Link to="/panel/pedidos" className={css.volver}>
            ← Pedidos
          </Link>
          <div className={css.titulo}>
            <h1 className="cifras">{numeroPedido(pedido.id)}</h1>
            <EstadoPedido codigo={pedido.estado.codigo} />
          </div>
          <p className={`${css.secundario} cifras`}>
            {formatoFechaHora(pedido.fechaCreacion)}
            {pedido.fechaModificacion && ` · Última modificación ${formatoFechaHora(pedido.fechaModificacion)}`}
          </p>
        </div>
        {(siguientes.length > 0 || admiteDevolucion) && (
          <div className={css.acciones}>
            {siguientes.map((e) => (
              <Boton key={e} variante={e === 'CANCELADO' ? 'secundario' : 'primario'} chico onClick={() => setEstadoNuevo(e)}>
                {ACCION_ESTADO[e]}
              </Boton>
            ))}
            {admiteDevolucion && (
              <Boton variante="secundario" chico onClick={() => setDevolviendo(true)}>
                Registrar devolución
              </Boton>
            )}
          </div>
        )}
      </header>

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
            <HistorialPedido pedido={pedido} />
          </section>
        </div>

        <aside className={css.lateral}>
          <section className={css.bloque}>
            <h2>Cliente</h2>
            <p>{pedido.cliente.nombre}</p>
            <p className={css.secundario}>{pedido.cliente.correo}</p>
            <Link to={`/panel/pedidos?cliente=${encodeURIComponent(pedido.cliente.correo)}`} className={css.secundario}>
              Ver sus pedidos
            </Link>
          </section>
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

      {estadoNuevo && <CambiarEstado pedido={pedido} estado={estadoNuevo} alCerrar={() => setEstadoNuevo(null)} />}
      {devolviendo && <Devolucion pedido={pedido} alCerrar={() => setDevolviendo(false)} />}
    </article>
  );
}
