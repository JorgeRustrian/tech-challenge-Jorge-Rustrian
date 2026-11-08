import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErrorApi } from '../../api/cliente';
import { ORDENES_CATALOGO, type Categoria, type ProductoTienda } from '../../api/catalogo';
import { Boton } from '../../componentes/Boton';
import { Casilla } from '../../componentes/Campos';
import { Cargando, ErrorVista, Vacio } from '../../componentes/Estados';
import { IconoCerrar } from '../../componentes/Iconos';
import { ImagenProducto } from '../../componentes/ImagenProducto';
import { Paginacion } from '../../componentes/Paginacion';
import { useCategorias } from '../../hooks/useCategorias';
import { useListado } from '../../hooks/useListado';
import { useTitulo } from '../../hooks/useTitulo';
import { formatoMoneda, formatoRangoPrecio } from '../../utils/formato';
import css from './Catalogo.module.css';

const FILTROS = ['texto', 'idCategoria', 'precioMin', 'precioMax', 'disponible'] as const;
const SIN_FILTROS = { texto: undefined, idCategoria: undefined, precioMin: undefined, precioMax: undefined, disponible: undefined };

type Filtros = Partial<Record<(typeof FILTROS)[number], string>>;
type CambiarFiltros = (cambios: Record<string, string | undefined>) => void;

function TarjetaProducto({ producto, prioridad }: { producto: ProductoTienda; prioridad: boolean }) {
  return (
    <li className={`${css.tarjeta} ${producto.disponible ? '' : css.agotado}`}>
      <Link to={`/producto/${producto.id}`} className={css.enlaceTarjeta}>
        <div className={css.foto}>
          <ImagenProducto url={producto.imagenPrincipal} alt="" prioridad={prioridad} />
          {!producto.disponible && <span className={css.etiquetaAgotado}>Agotado</span>}
        </div>
        <p className={css.categoriaTarjeta}>{producto.categoria}</p>
        <h2 className={css.nombre}>{producto.nombre}</h2>
        <p className={`${css.precio} cifras`}>{formatoRangoPrecio(producto.precioMin, producto.precioMax)}</p>
      </Link>
    </li>
  );
}

function FiltroPrecio({ filtros, alCambiar }: { filtros: Filtros; alCambiar: CambiarFiltros }) {
  const [min, setMin] = useState(filtros.precioMin ?? '');
  const [max, setMax] = useState(filtros.precioMax ?? '');
  const [error, setError] = useState<string | null>(null);

  function aplicar(e: FormEvent) {
    e.preventDefault();
    const nMin = min.trim() === '' ? undefined : Number(min);
    const nMax = max.trim() === '' ? undefined : Number(max);
    if ((nMin !== undefined && !(nMin >= 0)) || (nMax !== undefined && !(nMax >= 0))) {
      setError('Ingrese montos válidos.');
      return;
    }
    if (nMin !== undefined && nMax !== undefined && nMin > nMax) {
      setError('El mínimo no puede ser mayor que el máximo.');
      return;
    }
    setError(null);
    alCambiar({ precioMin: nMin?.toString(), precioMax: nMax?.toString() });
  }

  return (
    <form className={css.precioForm} onSubmit={aplicar} noValidate>
      <div className={css.precioCampos}>
        <label>
          <span className="solo-lector">Precio mínimo</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            placeholder="Mín."
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <span aria-hidden="true">–</span>
        <label>
          <span className="solo-lector">Precio máximo</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            placeholder="Máx."
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
      </div>
      {error && <p className={css.errorPrecio}>{error}</p>}
      <Boton type="submit" variante="secundario" chico>
        Aplicar
      </Boton>
    </form>
  );
}

function PanelFiltros({
  categorias,
  filtros,
  alCambiar,
}: {
  categorias: Categoria[];
  filtros: Filtros;
  alCambiar: CambiarFiltros;
}) {
  return (
    <>
      <fieldset className={css.grupo}>
        <legend>Categoría</legend>
        <ul className={css.listaCategorias}>
          <li>
            <button type="button" aria-pressed={!filtros.idCategoria} onClick={() => alCambiar({ idCategoria: undefined })}>
              Todas
            </button>
          </li>
          {categorias.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={filtros.idCategoria === String(c.id)}
                onClick={() => alCambiar({ idCategoria: String(c.id) })}
              >
                {c.nombre}
                <span className="cifras">{c.cantidadProductos}</span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className={css.grupo}>
        <legend>Precio (Q)</legend>
        <FiltroPrecio key={`${filtros.precioMin}-${filtros.precioMax}`} filtros={filtros} alCambiar={alCambiar} />
      </fieldset>

      <fieldset className={css.grupo}>
        <legend className="solo-lector">Existencia</legend>
        <Casilla
          etiqueta="Solo con existencia"
          checked={filtros.disponible === 'true'}
          onChange={(e) => alCambiar({ disponible: e.target.checked ? 'true' : undefined })}
        />
      </fieldset>
    </>
  );
}

function FiltrosActivos({
  filtros,
  categoria,
  alCambiar,
}: {
  filtros: Filtros;
  categoria: Categoria | undefined;
  alCambiar: CambiarFiltros;
}) {
  const activos: { clave: string; texto: string; quitar: Record<string, undefined> }[] = [];
  if (filtros.texto) activos.push({ clave: 'texto', texto: `“${filtros.texto}”`, quitar: { texto: undefined } });
  if (filtros.idCategoria) {
    activos.push({ clave: 'cat', texto: categoria?.nombre ?? 'Categoría', quitar: { idCategoria: undefined } });
  }
  if (filtros.precioMin || filtros.precioMax) {
    const texto = filtros.precioMin && filtros.precioMax
      ? `${formatoMoneda(Number(filtros.precioMin))} – ${formatoMoneda(Number(filtros.precioMax))}`
      : filtros.precioMin
        ? `Desde ${formatoMoneda(Number(filtros.precioMin))}`
        : `Hasta ${formatoMoneda(Number(filtros.precioMax))}`;
    activos.push({ clave: 'precio', texto, quitar: { precioMin: undefined, precioMax: undefined } });
  }
  if (filtros.disponible === 'true') activos.push({ clave: 'disp', texto: 'Con existencia', quitar: { disponible: undefined } });

  if (activos.length === 0) return null;

  return (
    <ul className={css.activos} aria-label="Filtros aplicados">
      {activos.map((a) => (
        <li key={a.clave}>
          <button type="button" onClick={() => alCambiar(a.quitar)} aria-label={`Quitar filtro ${a.texto}`}>
            {a.texto}
            <IconoCerrar width={12} height={12} />
          </button>
        </li>
      ))}
      {activos.length > 1 && (
        <li>
          <button type="button" className={css.quitarTodo} onClick={() => alCambiar(SIN_FILTROS)}>
            Quitar todos
          </button>
        </li>
      )}
    </ul>
  );
}

export function Catalogo() {
  const listado = useListado<ProductoTienda>({
    clave: 'catalogo',
    ruta: '/catalogo/productos',
    filtros: FILTROS,
    tamanio: 12,
    ordenInicial: 'recientes',
  });
  const categorias = useCategorias();
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const filtros: Filtros = listado.filtros;
  const categoria = categorias.data?.find((c) => String(c.id) === filtros.idCategoria);
  const hayFiltros = FILTROS.some((f) => filtros[f]);

  function cambiar(cambios: Record<string, string | undefined>) {
    listado.cambiarFiltros(cambios);
    setFiltrosAbiertos(false);
  }

  const titulo = categoria ? categoria.nombre : filtros.texto ? 'Resultados de búsqueda' : 'Toda la tienda';
  useTitulo(categoria?.nombre ?? (filtros.texto ? `Búsqueda: ${filtros.texto}` : undefined));
  const total = listado.paginacion?.total;

  let contenido;
  if (listado.cargando) {
    contenido = <Cargando texto="Cargando productos" />;
  } else if (listado.error) {
    // Un 400 aquí casi siempre es un filtro que se escribió a mano en la URL.
    const porFiltros = listado.error instanceof ErrorApi && listado.error.status === 400;
    contenido = porFiltros ? (
      <Vacio
        titulo="Los filtros de esta búsqueda no son válidos"
        accion={
          <Boton variante="secundario" chico onClick={() => cambiar(SIN_FILTROS)}>
            Quitar filtros
          </Boton>
        }
      />
    ) : (
      <ErrorVista error={listado.error} alReintentar={listado.recargar} />
    );
  } else if (!listado.datos?.length) {
    contenido = (
      <Vacio
        titulo="No encontramos productos"
        texto={hayFiltros ? 'Pruebe con otra búsqueda o quite algunos filtros.' : 'Todavía no hay productos a la venta.'}
        accion={
          hayFiltros && (
            <Boton variante="secundario" chico onClick={() => cambiar(SIN_FILTROS)}>
              Quitar filtros
            </Boton>
          )
        }
      />
    );
  } else {
    contenido = (
      <>
        <ul className={`${css.grilla} ${listado.actualizando ? css.actualizando : ''}`}>
          {listado.datos.map((p, i) => (
            <TarjetaProducto key={p.id} producto={p} prioridad={i < 4} />
          ))}
        </ul>
        {listado.paginacion && (
          <Paginacion
            paginacion={listado.paginacion}
            alCambiar={(n) => {
              listado.cambiarPagina(n);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className={css.catalogo}>
      <header className={css.cabecera}>
        <div>
          <h1>{titulo}</h1>
          {categoria?.descripcion && <p className={css.descripcion}>{categoria.descripcion}</p>}
          {!categoria && filtros.texto && <p className={css.descripcion}>Buscando “{filtros.texto}”</p>}
        </div>
        {total !== undefined && (
          <p className={`${css.total} cifras`}>
            {total} {total === 1 ? 'producto' : 'productos'}
          </p>
        )}
      </header>

      <div className={css.cuerpo}>
        <aside className={`${css.filtros} ${filtrosAbiertos ? css.filtrosAbiertos : ''}`} aria-label="Filtros">
          {categorias.data && <PanelFiltros categorias={categorias.data} filtros={filtros} alCambiar={cambiar} />}
        </aside>

        <section className={css.resultados}>
          <div className={css.barra}>
            <Boton
              variante="secundario"
              chico
              className={css.botonFiltros}
              aria-expanded={filtrosAbiertos}
              onClick={() => setFiltrosAbiertos((v) => !v)}
            >
              {filtrosAbiertos ? 'Ocultar filtros' : 'Filtros'}
            </Boton>
            <FiltrosActivos filtros={filtros} categoria={categoria} alCambiar={cambiar} />
            <label className={css.orden}>
              <span>Ordenar por</span>
              <select value={listado.orden} onChange={(e) => listado.cambiarOrden(e.target.value)}>
                {ORDENES_CATALOGO.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {contenido}
        </section>
      </div>
    </div>
  );
}
