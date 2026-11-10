import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { agregarAlCarrito } from '../../api/carrito';
import { ErrorApi } from '../../api/cliente';
import { obtenerProducto, type ProductoDetalle, type VarianteTienda } from '../../api/catalogo';
import { esPersonal } from '../../auth/roles';
import { useSesion } from '../../auth/sesion';
import { Boton, BotonEnlace } from '../../componentes/Boton';
import { Cantidad } from '../../componentes/Cantidad';
import { AvisoError, Cargando, ErrorVista, Vacio } from '../../componentes/Estados';
import { ImagenProducto } from '../../componentes/ImagenProducto';
import { useAccionCarrito, useCarrito } from '../../hooks/useCarrito';
import { useTitulo } from '../../hooks/useTitulo';
import { formatoMoneda } from '../../utils/formato';
import { NoEncontrada } from '../NoEncontrada';
import { elegir, estadoOpcion, opcionesDe, seleccionInicial, buscarVariante, type Seleccion } from './variantes';
import css from './Producto.module.css';

function Galeria({ producto }: { producto: ProductoDetalle }) {
  const imagenes = [...producto.imagenes].sort((a, b) => a.orden - b.orden);
  const [actual, setActual] = useState(0);
  const principal = imagenes[actual] ?? imagenes[0];

  return (
    <div className={css.galeria}>
      <ImagenProducto url={principal?.url ?? null} alt={producto.nombre} prioridad className={css.principal} />
      {imagenes.length > 1 && (
        <ul className={css.miniaturas}>
          {imagenes.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                aria-label={`Ver imagen ${i + 1} de ${imagenes.length}`}
                aria-current={i === actual || undefined}
                onClick={() => setActual(i)}
              >
                <ImagenProducto url={img.url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Selector({
  titulo,
  valorActual,
  opciones,
  estado,
  alElegir,
}: {
  titulo: string;
  valorActual: string | null;
  opciones: string[];
  estado: (opcion: string) => ReturnType<typeof estadoOpcion>;
  alElegir: (opcion: string) => void;
}) {
  if (opciones.length === 0) return null;
  return (
    <fieldset className={css.selector}>
      <legend>
        {titulo}
        {valorActual && <span>: {valorActual}</span>}
      </legend>
      <div className={css.opciones}>
        {opciones.map((o) => {
          const e = estado(o);
          return (
            <button
              key={o}
              type="button"
              className={css[e]}
              aria-pressed={o === valorActual}
              title={e === 'agotada' ? 'Agotado' : e === 'inexistente' ? 'No disponible en esta combinación' : undefined}
              onClick={() => alElegir(o)}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Disponibilidad({ variante, enCarrito }: { variante: VarianteTienda; enCarrito: number }) {
  const n = variante.existenciaDisponible;
  let texto;
  let clase = css.hay;
  if (n <= 0) {
    texto = 'Agotado';
    clase = css.sinExistencia;
  } else if (n <= 5) {
    texto = n === 1 ? 'Última unidad disponible' : `Últimas ${n} unidades`;
    clase = css.pocas;
  } else {
    texto = `${n} disponibles`;
  }
  return (
    <p className={css.disponibilidad}>
      <span className={clase}>{texto}</span>
      {enCarrito > 0 && (
        <span className={css.enCarrito}>
          Ya tiene {enCarrito} en su <Link to="/carrito">carrito</Link>
        </span>
      )}
    </p>
  );
}

function Compra({ producto, variante }: { producto: ProductoDetalle; variante: VarianteTienda }) {
  const queryClient = useQueryClient();
  const carrito = useCarrito();
  const agregar = useAccionCarrito(agregarAlCarrito);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState<number | null>(null);

  const enCarrito = carrito.data?.items.find((i) => i.idVariante === variante.id)?.cantidad ?? 0;
  const maximo = variante.existenciaDisponible - enCarrito;
  const cantidadValida = Math.min(cantidad, Math.max(1, maximo));

  function enviar() {
    setAgregado(null);
    agregar.mutate([variante.id, cantidadValida], {
      onSuccess: () => {
        setAgregado(cantidadValida);
        setCantidad(1);
      },
      onError: (err) => {
        // La existencia cambió desde que se abrió la página: se vuelve a pedir el producto.
        if (err instanceof ErrorApi && err.status === 409) {
          void queryClient.invalidateQueries({ queryKey: ['producto', producto.id] });
        }
      },
    });
  }

  return (
    <div className={css.compra}>
      <Disponibilidad variante={variante} enCarrito={enCarrito} />
      {variante.existenciaDisponible > 0 && (
        <div className={css.accionesCompra}>
          <Cantidad valor={cantidadValida} max={maximo} alCambiar={setCantidad} deshabilitado={maximo <= 0} />
          <Boton onClick={enviar} cargando={agregar.isPending} disabled={maximo <= 0} className={css.agregar}>
            Agregar al carrito
          </Boton>
        </div>
      )}
      {maximo <= 0 && variante.existenciaDisponible > 0 && (
        <p className={css.nota}>Ya tiene en su carrito todas las unidades disponibles de esta variante.</p>
      )}
      <AvisoError error={agregar.error} />
      {agregado !== null && (
        <p className={css.confirmacion} role="status">
          Se {agregado === 1 ? 'agregó 1 unidad' : `agregaron ${agregado} unidades`} a su carrito.{' '}
          <Link to="/carrito">Ver carrito</Link>
        </p>
      )}
    </div>
  );
}

function Ficha({ producto }: { producto: ProductoDetalle }) {
  const { usuario } = useSesion();
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const actual = seleccion ?? seleccionInicial(producto.variantes);
  const { tallas, colores } = opcionesDe(producto.variantes);
  const variante = actual ? buscarVariante(producto.variantes, actual) : undefined;

  const precios = producto.variantes.map((v) => v.precio);
  const precio = variante ? formatoMoneda(variante.precio) : precios.length ? `Desde ${formatoMoneda(Math.min(...precios))}` : null;

  return (
    <div className={css.ficha}>
      <p className={css.categoria}>{producto.categoria}</p>
      <h1>{producto.nombre}</h1>
      {precio && (
        <p className={css.precio}>
          <span className="cifras">{precio}</span>
          <span className={css.iva}>IVA incluido</span>
        </p>
      )}

      {actual && (
        <div className={css.selectores}>
          <Selector
            titulo="Talla"
            valorActual={actual.talla}
            opciones={tallas}
            estado={(talla) => estadoOpcion(producto.variantes, { ...actual, talla })}
            alElegir={(talla) => setSeleccion(elegir(producto.variantes, actual, { talla }))}
          />
          <Selector
            titulo="Color"
            valorActual={actual.color}
            opciones={colores}
            estado={(color) => estadoOpcion(producto.variantes, { ...actual, color })}
            alElegir={(color) => setSeleccion(elegir(producto.variantes, actual, { color }))}
          />
        </div>
      )}

      {!variante ? (
        <p className={css.nota}>Este producto no tiene variantes a la venta por ahora.</p>
      ) : usuario && esPersonal(usuario.rol) ? (
        <p className={css.notaPersonal}>
          Está viendo la tienda con una cuenta de personal. Las compras se hacen con una cuenta de cliente.
        </p>
      ) : (
        // La clave reinicia cantidad y mensajes al cambiar de variante.
        <Compra key={variante.id} producto={producto} variante={variante} />
      )}

      {variante && <p className={`${css.sku} cifras`}>SKU {variante.sku}</p>}

      {producto.descripcion && (
        <section className={css.descripcion}>
          <h2>Descripción</h2>
          <p>{producto.descripcion}</p>
        </section>
      )}
    </div>
  );
}

export function Producto() {
  const { id } = useParams();
  const idProducto = Number(id);
  const valido = Number.isInteger(idProducto) && idProducto > 0;

  const consulta = useQuery({
    queryKey: ['producto', idProducto],
    queryFn: ({ signal }) => obtenerProducto(idProducto, signal),
    enabled: valido,
  });
  useTitulo(consulta.data?.nombre);

  if (!valido) return <NoEncontrada />;
  if (consulta.isPending) return <Cargando texto="Cargando producto" />;
  if (consulta.error) {
    if (consulta.error instanceof ErrorApi && consulta.error.status === 404) {
      return (
        <Vacio
          titulo="Este producto ya no está a la venta"
          texto="Puede que se haya retirado del catálogo."
          accion={
            <BotonEnlace to="/" variante="secundario">
              Ver el catálogo
            </BotonEnlace>
          }
        />
      );
    }
    return <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;
  }

  const producto = consulta.data;
  return (
    <article>
      <nav className={css.migas} aria-label="Ruta">
        <Link to="/">Tienda</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/?idCategoria=${producto.idCategoria}`}>{producto.categoria}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{producto.nombre}</span>
      </nav>
      {/* La clave reinicia la imagen y la variante elegidas al pasar a otro producto. */}
      <div className={css.producto} key={producto.id}>
        <Galeria producto={producto} />
        <Ficha producto={producto} />
      </div>
    </article>
  );
}
