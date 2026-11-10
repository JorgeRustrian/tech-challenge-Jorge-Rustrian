import type { PedidoDetalle } from '../../api/pedidos';
import { formatoFechaHora, formatoMoneda } from '../../utils/formato';
import { etiquetaEstadoPedido } from '../Insignia';
import css from './PartesPedido.module.css';

// Piezas del detalle de un pedido que comparten "Mis pedidos" y el panel.

export function LineasPedido({ pedido }: { pedido: PedidoDetalle }) {
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
                <p className={css.secundario}>{[l.talla && `Talla ${l.talla}`, l.color, l.sku].filter(Boolean).join(' · ')}</p>
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

export function MontosPedido({ pedido }: { pedido: PedidoDetalle }) {
  const { montos } = pedido;
  return (
    <>
      <dl className={`${css.montos} cifras`}>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatoMoneda(montos.subtotal)}</dd>
        </div>
        {montos.descuento > 0 && (
          <div className={css.acento}>
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
          <div className={css.acento}>
            <dt>Reembolsado</dt>
            <dd>{formatoMoneda(montos.reembolsado)}</dd>
          </div>
        )}
      </dl>
      {pedido.referenciaPago && <p className={`${css.referencia} cifras`}>Referencia {pedido.referenciaPago}</p>}
    </>
  );
}

// vistaCliente: el cliente no ve el nombre del personal que movió su pedido, solo "ShopCart".
export function HistorialPedido({ pedido, vistaCliente }: { pedido: PedidoDetalle; vistaCliente?: boolean }) {
  // La API los entrega en orden; el más reciente se muestra arriba.
  const eventos = [...pedido.historial].reverse();
  const autor = (u: { id: number; nombre: string }) => (vistaCliente && u.id !== pedido.cliente.id ? 'ShopCart' : u.nombre);
  return (
    <ol className={css.historial}>
      {eventos.map((h, i) => (
        <li key={`${h.fecha}-${i}`}>
          <p className={css.evento}>{etiquetaEstadoPedido(h.estadoNuevo)}</p>
          <p className={`${css.secundario} cifras`}>
            {formatoFechaHora(h.fecha)} · {autor(h.usuario)}
          </p>
          {h.comentario && <p className={css.comentario}>{h.comentario}</p>}
        </li>
      ))}
    </ol>
  );
}

export function DevolucionesPedido({ pedido }: { pedido: PedidoDetalle }) {
  return (
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
  );
}
