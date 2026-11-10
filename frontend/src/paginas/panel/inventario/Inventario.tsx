import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { obtenerCategoriasPanel } from '../../../api/catalogo';
import { conciliarInventario, type ExistenciaVariante } from '../../../api/inventario';
import { Boton } from '../../../componentes/Boton';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { Cargando, ErrorVista } from '../../../componentes/Estados';
import { BarraFiltros, CampoBusqueda, CampoSeleccion } from '../../../componentes/Filtros';
import { Insignia } from '../../../componentes/Insignia';
import { Modal } from '../../../componentes/Modal';
import { Paginacion } from '../../../componentes/Paginacion';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { useListado } from '../../../hooks/useListado';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoMoneda } from '../../../utils/formato';
import { descripcionVariante, Disponible, UMBRAL_EXISTENCIA_BAJA } from './comun';
import { ModalMovimiento, type VarianteMovimiento } from './ModalMovimiento';
import css from './Inventario.module.css';

function Conciliacion({ alCerrar }: { alCerrar: () => void }) {
  const consulta = useQuery({ queryKey: ['conciliacion'], queryFn: ({ signal }) => conciliarInventario(signal), gcTime: 0 });

  let contenido;
  if (consulta.isPending) contenido = <Cargando texto="Comparando existencias con el kardex" />;
  else if (consulta.error) contenido = <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;
  else {
    const { variantesRevisadas, descuadres } = consulta.data;
    contenido =
      descuadres.length === 0 ? (
        <p className={css.cuadra}>
          Se revisaron <strong className="cifras">{variantesRevisadas}</strong> variantes y todas cuadran: la existencia
          física coincide con la suma de su kardex y lo reservado con las reservas activas.
        </p>
      ) : (
        <>
          <p className={css.descuadre}>
            {descuadres.length} de {variantesRevisadas} variantes no cuadran. Revise su kardex.
          </p>
          <table className={css.tablaSimple}>
            <thead>
              <tr>
                <th>SKU</th>
                <th className={css.num}>Física</th>
                <th className={css.num}>Suma kardex</th>
                <th className={css.num}>Reservada</th>
                <th className={css.num}>Reservas activas</th>
              </tr>
            </thead>
            <tbody className="cifras">
              {descuadres.map((d) => (
                <tr key={d.idVariante}>
                  <td>
                    <Link to={`/panel/inventario/${d.idVariante}`}>{d.sku}</Link>
                  </td>
                  <td className={css.num}>{d.existenciaFisica}</td>
                  <td className={css.num}>{d.sumaKardex}</td>
                  <td className={css.num}>{d.existenciaReservada}</td>
                  <td className={css.num}>{d.reservasActivas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Conciliación de inventario"
      ancho="amplio"
      pie={
        <Boton variante="secundario" onClick={alCerrar}>
          Cerrar
        </Boton>
      }
    >
      {contenido}
    </Modal>
  );
}

type Accion = { tipo: 'entrada' | 'ajuste'; variante: VarianteMovimiento } | null;

export function Inventario() {
  useTitulo('Inventario');
  const [accion, setAccion] = useState<Accion>(null);
  const [conciliando, setConciliando] = useState(false);
  const categorias = useQuery({ queryKey: ['categorias-panel'], queryFn: ({ signal }) => obtenerCategoriasPanel(signal) });

  const listado = useListado<ExistenciaVariante>({
    clave: 'existencias',
    ruta: '/admin/inventario/existencias',
    filtros: ['texto', 'idCategoria', 'existenciaMaxima', 'activo'],
    tamanio: 25,
    ordenInicial: 'sku',
  });
  const { filtros } = listado;

  const abrir = (tipo: 'entrada' | 'ajuste', v: ExistenciaVariante) =>
    setAccion({ tipo, variante: { id: v.idVariante, sku: v.sku, descripcion: descripcionVariante(v), existencias: v.existencias } });

  const columnas: Columna<ExistenciaVariante>[] = [
    {
      clave: 'sku',
      titulo: 'SKU',
      orden: 'sku',
      celda: (v) => (
        <Link to={`/panel/inventario/${v.idVariante}`} className={`${css.sku} cifras`}>
          {v.sku}
        </Link>
      ),
    },
    {
      clave: 'producto',
      titulo: 'Producto',
      celda: (v) => (
        <>
          {descripcionVariante(v)}
          {(!v.activo || !v.productoActivo) && (
            <>
              {' '}
              <Insignia>Inactivo</Insignia>
            </>
          )}
        </>
      ),
    },
    { clave: 'categoria', titulo: 'Categoría', celda: (v) => v.categoria },
    { clave: 'precio', titulo: 'Precio', alinear: 'derecha', celda: (v) => formatoMoneda(v.precio) },
    { clave: 'fisica', titulo: 'Física', alinear: 'derecha', celda: (v) => v.existencias.fisica },
    { clave: 'reservada', titulo: 'Reserv.', alinear: 'derecha', celda: (v) => v.existencias.reservada || '—' },
    {
      clave: 'disponible',
      titulo: 'Disp.',
      alinear: 'derecha',
      orden: 'disponible',
      celda: (v) => <Disponible n={v.existencias.disponible} />,
    },
    {
      clave: 'acciones',
      titulo: '',
      alinear: 'derecha',
      celda: (v) => (
        <span className={css.accionesFila}>
          <button type="button" onClick={() => abrir('entrada', v)}>
            Entrada
          </button>
          <button type="button" onClick={() => abrir('ajuste', v)}>
            Ajuste
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Inventario"
        descripcion={listado.paginacion && `${listado.paginacion.total} variantes`}
        acciones={
          <Boton variante="secundario" chico onClick={() => setConciliando(true)}>
            Conciliar con el kardex
          </Boton>
        }
      />

      <BarraFiltros>
        <CampoBusqueda
          etiqueta="Buscar"
          valor={filtros.texto ?? ''}
          placeholder="SKU o producto"
          alCambiar={(texto) => listado.cambiarFiltros({ texto })}
        />
        <CampoSeleccion
          etiqueta="Categoría"
          valor={filtros.idCategoria ?? ''}
          opciones={[
            { valor: '', etiqueta: 'Todas' },
            ...(categorias.data ?? []).map((c) => ({ valor: String(c.id), etiqueta: c.nombre })),
          ]}
          alCambiar={(idCategoria) => listado.cambiarFiltros({ idCategoria })}
        />
        <CampoSeleccion
          etiqueta="Disponible"
          valor={filtros.existenciaMaxima ?? ''}
          opciones={[
            { valor: '', etiqueta: 'Cualquiera' },
            { valor: '0', etiqueta: 'Agotadas' },
            { valor: String(UMBRAL_EXISTENCIA_BAJA), etiqueta: `Bajas (${UMBRAL_EXISTENCIA_BAJA} o menos)` },
            { valor: '10', etiqueta: '10 o menos' },
          ]}
          alCambiar={(existenciaMaxima) => listado.cambiarFiltros({ existenciaMaxima })}
        />
        <CampoSeleccion
          etiqueta="Estado"
          valor={filtros.activo ?? ''}
          opciones={[
            { valor: '', etiqueta: 'Todas' },
            { valor: 'true', etiqueta: 'Activas' },
            { valor: 'false', etiqueta: 'Inactivas' },
          ]}
          alCambiar={(activo) => listado.cambiarFiltros({ activo })}
        />
      </BarraFiltros>

      <Tabla
        columnas={columnas}
        filas={listado.datos}
        claveFila={(v) => v.idVariante}
        cargando={listado.cargando}
        error={listado.error}
        alReintentar={listado.recargar}
        actualizando={listado.actualizando}
        orden={listado.orden}
        alOrdenar={listado.cambiarOrden}
        vacio={{ titulo: 'Sin resultados', texto: 'Ninguna variante coincide con los filtros.' }}
      />
      {listado.paginacion && <Paginacion paginacion={listado.paginacion} alCambiar={listado.cambiarPagina} />}

      {accion && <ModalMovimiento tipo={accion.tipo} variante={accion.variante} alCerrar={() => setAccion(null)} />}
      {conciliando && <Conciliacion alCerrar={() => setConciliando(false)} />}
    </>
  );
}
