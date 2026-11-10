import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorApi } from '../../../api/cliente';
import { TIPOS_MOVIMIENTO, type Movimiento, type RespuestaKardex } from '../../../api/inventario';
import { numeroPedido } from '../../../api/pedidos';
import { Boton, BotonEnlace } from '../../../componentes/Boton';
import { Cargando, ErrorVista, Vacio } from '../../../componentes/Estados';
import { BarraFiltros, CampoSeleccion, FiltroFechas } from '../../../componentes/Filtros';
import { Insignia, type Tono } from '../../../componentes/Insignia';
import { Paginacion } from '../../../componentes/Paginacion';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { useListado } from '../../../hooks/useListado';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoFechaHora } from '../../../utils/formato';
import { NoEncontrada } from '../../NoEncontrada';
import { descripcionVariante, Disponible } from './comun';
import { ModalMovimiento } from './ModalMovimiento';
import css from './Inventario.module.css';

const TONO_MOVIMIENTO: Record<string, Tono> = {
  ENTRADA: 'exito',
  VENTA: 'info',
  AJUSTE: 'aviso',
  DEVOLUCION: 'acento',
  CANCELACION: 'neutro',
};

const COLUMNAS: Columna<Movimiento>[] = [
  { clave: 'fecha', titulo: 'Fecha', celda: (m) => <span className="cifras">{formatoFechaHora(m.fecha)}</span> },
  {
    clave: 'tipo',
    titulo: 'Tipo',
    celda: (m) => (
      <Insignia tono={TONO_MOVIMIENTO[m.tipo] ?? 'neutro'}>
        {TIPOS_MOVIMIENTO.find((t) => t.valor === m.tipo)?.etiqueta ?? m.tipo}
      </Insignia>
    ),
  },
  {
    clave: 'cantidad',
    titulo: 'Cantidad',
    alinear: 'derecha',
    celda: (m) => <span className={m.cantidad > 0 ? css.suma : css.resta}>{m.cantidad > 0 ? `+${m.cantidad}` : `−${-m.cantidad}`}</span>,
  },
  {
    clave: 'saldo',
    titulo: 'Física',
    alinear: 'derecha',
    celda: (m) => (
      <span className={css.saldo}>
        {m.existenciaAnterior} → <strong>{m.existenciaNueva}</strong>
      </span>
    ),
  },
  { clave: 'motivo', titulo: 'Motivo', celda: (m) => m.motivo ?? '—' },
  {
    clave: 'pedido',
    titulo: 'Pedido',
    celda: (m) =>
      m.idPedido ? (
        <Link to={`/panel/pedidos/${m.idPedido}`} className="cifras">
          {numeroPedido(m.idPedido)}
        </Link>
      ) : (
        '—'
      ),
  },
  { clave: 'usuario', titulo: 'Usuario', celda: (m) => m.usuario.nombre },
];

export function Kardex() {
  const { id } = useParams();
  const idVariante = Number(id);
  const valido = Number.isInteger(idVariante) && idVariante > 0;
  const [accion, setAccion] = useState<'entrada' | 'ajuste' | null>(null);

  const listado = useListado<Movimiento, RespuestaKardex>({
    clave: 'kardex',
    ruta: `/admin/inventario/variantes/${idVariante}/kardex`,
    filtros: ['tipo', 'fechaDesde', 'fechaHasta'],
    tamanio: 25,
    habilitado: valido,
  });
  const variante = listado.respuesta?.variante;
  useTitulo(variante ? `Kardex ${variante.sku}` : 'Kardex');

  if (!valido) return <NoEncontrada />;
  if (!variante) {
    if (listado.error instanceof ErrorApi && listado.error.status === 404) {
      return (
        <Vacio
          titulo="Esta variante no existe"
          accion={
            <BotonEnlace to="/panel/inventario" variante="secundario">
              Ver inventario
            </BotonEnlace>
          }
        />
      );
    }
    if (listado.error) return <ErrorVista error={listado.error} alReintentar={listado.recargar} />;
    return <Cargando texto="Cargando kardex" />;
  }

  const { filtros } = listado;

  return (
    <>
      <header className={css.cabecera}>
        <div>
          <Link to="/panel/inventario" className={css.volver}>
            ← Inventario
          </Link>
          <h1 className="cifras">{variante.sku}</h1>
          <p className={css.secundario}>{descripcionVariante(variante)}</p>
        </div>
        <div className={css.resumen}>
          <dl className={`${css.existencias} cifras`}>
            <div>
              <dt>Física</dt>
              <dd>{variante.existencias.fisica}</dd>
            </div>
            <div>
              <dt>Reservada</dt>
              <dd>{variante.existencias.reservada}</dd>
            </div>
            <div>
              <dt>Disponible</dt>
              <dd>
                <Disponible n={variante.existencias.disponible} />
              </dd>
            </div>
          </dl>
          <div className={css.botones}>
            <Boton chico onClick={() => setAccion('entrada')}>
              Registrar entrada
            </Boton>
            <Boton variante="secundario" chico onClick={() => setAccion('ajuste')}>
              Ajuste
            </Boton>
          </div>
        </div>
      </header>

      <BarraFiltros>
        <CampoSeleccion
          etiqueta="Tipo"
          valor={filtros.tipo ?? ''}
          opciones={[{ valor: '', etiqueta: 'Todos' }, ...TIPOS_MOVIMIENTO]}
          alCambiar={(tipo) => listado.cambiarFiltros({ tipo })}
        />
        <FiltroFechas
          key={`${filtros.fechaDesde}-${filtros.fechaHasta}`}
          desde={filtros.fechaDesde}
          hasta={filtros.fechaHasta}
          alAplicar={listado.cambiarFiltros}
        />
      </BarraFiltros>

      <Tabla
        columnas={COLUMNAS}
        filas={listado.datos}
        claveFila={(m) => m.id}
        cargando={listado.cargando}
        error={listado.error}
        alReintentar={listado.recargar}
        actualizando={listado.actualizando}
        vacio={{ titulo: 'Sin movimientos', texto: 'No hay movimientos con esos filtros.' }}
      />
      {listado.paginacion && <Paginacion paginacion={listado.paginacion} alCambiar={listado.cambiarPagina} />}

      {accion && (
        <ModalMovimiento
          tipo={accion}
          variante={{
            id: variante.id,
            sku: variante.sku,
            descripcion: descripcionVariante(variante),
            existencias: variante.existencias,
          }}
          alCerrar={() => setAccion(null)}
        />
      )}
    </>
  );
}
