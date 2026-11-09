import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { obtenerCategoriasPanel, type ProductoPanel } from '../../../api/catalogo';
import { usePuedeEditarCatalogo } from './comun';
import { BotonEnlace } from '../../../componentes/Boton';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { BarraFiltros, CampoBusqueda, CampoSeleccion } from '../../../componentes/Filtros';
import { ImagenProducto } from '../../../componentes/ImagenProducto';
import { Insignia } from '../../../componentes/Insignia';
import { Paginacion } from '../../../componentes/Paginacion';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { useListado } from '../../../hooks/useListado';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoMoneda } from '../../../utils/formato';
import css from './Catalogo.module.css';

function precios(p: ProductoPanel) {
  if (p.precioMin === null) return <span className={css.secundario}>Sin variantes</span>;
  return p.precioMin === p.precioMax ? formatoMoneda(p.precioMin) : `${formatoMoneda(p.precioMin)} – ${formatoMoneda(p.precioMax ?? p.precioMin)}`;
}

const COLUMNAS: Columna<ProductoPanel>[] = [
  {
    clave: 'producto',
    titulo: 'Producto',
    orden: 'nombre',
    celda: (p) => (
      <Link to={`/panel/productos/${p.id}`} className={css.productoFila}>
        <ImagenProducto url={p.imagenPrincipal} alt="" className={css.miniatura} />
        <span className={css.nombre}>{p.nombre}</span>
      </Link>
    ),
  },
  { clave: 'categoria', titulo: 'Categoría', celda: (p) => p.categoria },
  { clave: 'variantes', titulo: 'Variantes', alinear: 'derecha', celda: (p) => p.cantidadVariantes },
  {
    clave: 'precio',
    titulo: 'Precio',
    alinear: 'derecha',
    orden: ['precio_asc', 'precio_desc'],
    celda: precios,
  },
  {
    clave: 'disponible',
    titulo: 'Disponible',
    alinear: 'derecha',
    celda: (p) => <span className={p.existenciaDisponible === 0 ? css.agotado : undefined}>{p.existenciaDisponible}</span>,
  },
  {
    clave: 'estado',
    titulo: 'Estado',
    celda: (p) => <Insignia tono={p.activo ? 'exito' : 'neutro'}>{p.activo ? 'Activo' : 'Inactivo'}</Insignia>,
  },
];

const ESTADOS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'true', etiqueta: 'Activos' },
  { valor: 'false', etiqueta: 'Inactivos' },
];

// La API solo filtra "con existencia"; los agotados se ven en Inventario.
const EXISTENCIA = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'true', etiqueta: 'Con existencia' },
];

export function Productos() {
  useTitulo('Productos');
  const puedeEditar = usePuedeEditarCatalogo();
  const categorias = useQuery({ queryKey: ['categorias-panel'], queryFn: ({ signal }) => obtenerCategoriasPanel(signal) });
  const listado = useListado<ProductoPanel>({
    clave: 'panel-productos',
    ruta: '/admin/catalogo/productos',
    filtros: ['texto', 'idCategoria', 'activo', 'disponible'],
    tamanio: 20,
    ordenInicial: 'recientes',
  });
  const { filtros } = listado;

  return (
    <>
      <EncabezadoPagina
        titulo="Productos"
        descripcion={
          listado.paginacion && `${listado.paginacion.total} ${listado.paginacion.total === 1 ? 'producto' : 'productos'}`
        }
        acciones={puedeEditar && <BotonEnlace to="/panel/productos/nuevo">Nuevo producto</BotonEnlace>}
      />

      <BarraFiltros>
        <CampoBusqueda
          etiqueta="Buscar"
          valor={filtros.texto ?? ''}
          placeholder="Nombre del producto"
          alCambiar={(texto) => listado.cambiarFiltros({ texto })}
        />
        <CampoSeleccion
          etiqueta="Categoría"
          valor={filtros.idCategoria ?? ''}
          opciones={[
            { valor: '', etiqueta: 'Todas' },
            ...(categorias.data ?? []).map((c) => ({ valor: String(c.id), etiqueta: c.activo ? c.nombre : `${c.nombre} (inactiva)` })),
          ]}
          alCambiar={(idCategoria) => listado.cambiarFiltros({ idCategoria })}
        />
        <CampoSeleccion
          etiqueta="Existencia"
          valor={filtros.disponible ?? ''}
          opciones={EXISTENCIA}
          alCambiar={(disponible) => listado.cambiarFiltros({ disponible })}
        />
        <CampoSeleccion
          etiqueta="Estado"
          valor={filtros.activo ?? ''}
          opciones={ESTADOS}
          alCambiar={(activo) => listado.cambiarFiltros({ activo })}
        />
      </BarraFiltros>

      <Tabla
        columnas={COLUMNAS}
        filas={listado.datos}
        claveFila={(p) => p.id}
        cargando={listado.cargando}
        error={listado.error}
        alReintentar={listado.recargar}
        actualizando={listado.actualizando}
        orden={listado.orden}
        alOrdenar={listado.cambiarOrden}
        vacio={{ titulo: 'Sin productos', texto: 'No hay productos que coincidan con los filtros.' }}
      />
      {listado.paginacion && <Paginacion paginacion={listado.paginacion} alCambiar={listado.cambiarPagina} />}
    </>
  );
}
