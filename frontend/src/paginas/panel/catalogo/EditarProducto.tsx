import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { ErrorApi } from '../../../api/cliente';
import {
  actualizarProducto,
  cambiarEstadoProducto,
  cambiarEstadoVariante,
  crearProducto,
  eliminarProducto,
  obtenerCategoriasPanel,
  obtenerProductoPanel,
  type ProductoPanelDetalle,
  type VariantePanel,
} from '../../../api/catalogo';
import { useAvisos } from '../../../componentes/Avisos';
import { Boton, BotonEnlace } from '../../../componentes/Boton';
import { AreaTexto, Entrada, Seleccion } from '../../../componentes/Campos';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { AvisoError, Cargando, ErrorVista, Vacio } from '../../../componentes/Estados';
import { Insignia } from '../../../componentes/Insignia';
import { Confirmar } from '../../../componentes/Modal';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoFechaHora, formatoMoneda } from '../../../utils/formato';
import { erroresEnCampos } from '../../../utils/formularios';
import { useAlCambiarCatalogo, usePuedeEditarCatalogo } from './comun';
import { EditorImagenes } from './EditorImagenes';
import { ModalVariante } from './ModalVariante';
import css from './Catalogo.module.css';

const esquema = z.object({
  idCategoria: z.string().min(1, 'Elija la categoría'),
  nombre: z.string().trim().min(1, 'Escriba el nombre').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
});

type Valores = z.infer<typeof esquema>;

function Datos({ producto, soloLectura }: { producto?: ProductoPanelDetalle; soloLectura: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const alCambiar = useAlCambiarCatalogo();
  const [imagenes, setImagenes] = useState(() => producto?.imagenes.map((i) => i.url) ?? []);
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const categorias = useQuery({ queryKey: ['categorias-panel'], queryFn: ({ signal }) => obtenerCategoriasPanel(signal) });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      idCategoria: producto ? String(producto.idCategoria) : '',
      nombre: producto?.nombre ?? '',
      descripcion: producto?.descripcion ?? '',
    },
  });

  async function enviar(v: Valores) {
    setErrorEnvio(null);
    const datos = { idCategoria: Number(v.idCategoria), nombre: v.nombre, descripcion: v.descripcion || null, imagenes };
    try {
      if (producto) {
        const guardado = await actualizarProducto(producto.id, datos);
        queryClient.setQueryData(['producto-panel', producto.id], guardado);
        avisar('exito', 'Se guardaron los cambios del producto.');
      } else {
        const creado = await crearProducto(datos);
        avisar('exito', 'Se creó el producto. Agregue sus variantes para poder venderlo.');
        navigate(`/panel/productos/${creado.id}`, { replace: true });
      }
      alCambiar();
    } catch (err) {
      if (!erroresEnCampos(err, setError, ['idCategoria', 'nombre', 'descripcion'])) setErrorEnvio(err);
    }
  }

  // Solo se ofrecen categorías activas; la actual se muestra aunque esté inactiva para que no se pierda.
  const opciones = (categorias.data ?? []).filter((c) => c.activo || c.id === producto?.idCategoria);

  return (
    <>
      <section className={css.seccion}>
        <h2>Datos</h2>
        <form id="form-producto" className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
          <AvisoError error={errorEnvio} />
          <fieldset className={css.campos} disabled={soloLectura}>
            <Seleccion etiqueta="Categoría" error={errors.idCategoria?.message} {...register('idCategoria')}>
              <option value="">{categorias.isPending ? 'Cargando…' : 'Elija una categoría'}</option>
              {opciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.activo ? c.nombre : `${c.nombre} (inactiva)`}
                </option>
              ))}
            </Seleccion>
            <Entrada etiqueta="Nombre" maxLength={150} error={errors.nombre?.message} {...register('nombre')} />
            <AreaTexto
              etiqueta="Descripción (opcional)"
              rows={4}
              maxLength={2000}
              error={errors.descripcion?.message}
              {...register('descripcion')}
            />
          </fieldset>
        </form>
      </section>

      <section className={css.seccion}>
        <h2>Imágenes</h2>
        <EditorImagenes urls={imagenes} alCambiar={setImagenes} soloLectura={soloLectura} />
      </section>

      {!soloLectura && (
        <div className={css.barraGuardar}>
          <Boton type="submit" form="form-producto" cargando={isSubmitting}>
            {producto ? 'Guardar cambios' : 'Crear producto'}
          </Boton>
          <BotonEnlace to="/panel/productos" variante="secundario">
            {producto ? 'Volver al listado' : 'Cancelar'}
          </BotonEnlace>
        </div>
      )}
    </>
  );
}

function Variantes({ producto, soloLectura }: { producto: ProductoPanelDetalle; soloLectura: boolean }) {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const alCambiar = useAlCambiarCatalogo();
  const [editando, setEditando] = useState<VariantePanel | 'nueva' | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<VariantePanel | null>(null);

  const recargar = () => {
    void queryClient.invalidateQueries({ queryKey: ['producto-panel', producto.id] });
    alCambiar();
  };

  const estado = useMutation({
    mutationFn: (v: VariantePanel) => cambiarEstadoVariante(v.id, !v.activo),
    onSuccess: (v) => {
      avisar('exito', `La variante ${v.sku} quedó ${v.activo ? 'activa' : 'inactiva'}.`);
      recargar();
      setCambiandoEstado(null);
    },
  });

  const columnas: Columna<VariantePanel>[] = [
    {
      clave: 'sku',
      titulo: 'SKU',
      celda: (v) => (
        <Link to={`/panel/inventario/${v.id}`} className={css.sku} title="Ver kardex">
          {v.sku}
        </Link>
      ),
    },
    { clave: 'talla', titulo: 'Talla', celda: (v) => v.talla ?? '—' },
    { clave: 'color', titulo: 'Color', celda: (v) => v.color ?? '—' },
    { clave: 'precio', titulo: 'Precio', alinear: 'derecha', celda: (v) => formatoMoneda(v.precio) },
    { clave: 'fisica', titulo: 'Física', alinear: 'derecha', celda: (v) => v.existenciaFisica },
    { clave: 'reservada', titulo: 'Reserv.', alinear: 'derecha', celda: (v) => v.existenciaReservada },
    {
      clave: 'disponible',
      titulo: 'Disp.',
      alinear: 'derecha',
      celda: (v) => <span className={v.existenciaDisponible === 0 ? css.agotado : undefined}>{v.existenciaDisponible}</span>,
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (v) => <Insignia tono={v.activo ? 'exito' : 'neutro'}>{v.activo ? 'Activa' : 'Inactiva'}</Insignia>,
    },
  ];
  if (!soloLectura) {
    columnas.push({
      clave: 'acciones',
      titulo: '',
      alinear: 'derecha',
      celda: (v) => (
        <span className={css.accionesFila}>
          <button type="button" onClick={() => setEditando(v)}>
            Editar
          </button>
          <button type="button" onClick={() => setCambiandoEstado(v)}>
            {v.activo ? 'Desactivar' : 'Activar'}
          </button>
        </span>
      ),
    });
  }

  const activas = producto.variantes.filter((v) => v.activo).length;

  return (
    <section className={css.seccion}>
      <header className={css.cabeceraSeccion}>
        <div>
          <h2>Variantes</h2>
          <p className={css.secundario}>
            {producto.variantes.length === 0
              ? 'Sin variantes, el producto no se puede comprar.'
              : `${activas} de ${producto.variantes.length} a la venta. El SKU lleva al kardex.`}
          </p>
        </div>
        {!soloLectura && (
          <Boton variante="secundario" chico onClick={() => setEditando('nueva')}>
            Nueva variante
          </Boton>
        )}
      </header>

      <Tabla
        columnas={columnas}
        filas={producto.variantes}
        claveFila={(v) => v.id}
        cargando={false}
        error={null}
        vacio={{ titulo: 'Sin variantes', texto: 'Agregue al menos una con su SKU, talla, color y precio.' }}
      />

      {editando && (
        <ModalVariante
          idProducto={producto.id}
          variante={editando === 'nueva' ? undefined : editando}
          alGuardar={recargar}
          alCerrar={() => setEditando(null)}
        />
      )}
      {cambiandoEstado && (
        <Confirmar
          abierto
          titulo={`${cambiandoEstado.activo ? 'Desactivar' : 'Activar'} ${cambiandoEstado.sku}`}
          textoConfirmar={cambiandoEstado.activo ? 'Desactivar' : 'Activar'}
          peligro={cambiandoEstado.activo}
          cargando={estado.isPending}
          alConfirmar={() => estado.mutate(cambiandoEstado)}
          alCancelar={() => {
            estado.reset();
            setCambiandoEstado(null);
          }}
        >
          <AvisoError error={estado.error} />
          <p>
            {cambiandoEstado.activo
              ? 'Deja de ofrecerse en la tienda. Su existencia y su kardex se conservan.'
              : 'Vuelve a ofrecerse en la tienda con la existencia que tenga.'}
          </p>
        </Confirmar>
      )}
    </section>
  );
}

function AccionesProducto({ producto }: { producto: ProductoPanelDetalle }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const alCambiar = useAlCambiarCatalogo();
  const [confirmando, setConfirmando] = useState<'estado' | 'eliminar' | null>(null);

  const estado = useMutation({
    mutationFn: () => cambiarEstadoProducto(producto.id, !producto.activo),
    onSuccess: (p) => {
      queryClient.setQueryData(['producto-panel', p.id], p);
      alCambiar();
      avisar('exito', p.activo ? 'El producto volvió a la tienda.' : 'El producto ya no se muestra en la tienda.');
      setConfirmando(null);
    },
  });
  const eliminar = useMutation({
    mutationFn: () => eliminarProducto(producto.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['producto-panel', producto.id] });
      alCambiar();
      avisar('exito', `Se eliminó «${producto.nombre}».`);
      navigate('/panel/productos', { replace: true });
    },
  });
  const cerrar = () => {
    estado.reset();
    eliminar.reset();
    setConfirmando(null);
  };

  return (
    <>
      <Boton variante="secundario" chico onClick={() => setConfirmando('estado')}>
        {producto.activo ? 'Desactivar' : 'Activar'}
      </Boton>
      <Boton variante="fantasma" chico onClick={() => setConfirmando('eliminar')}>
        Eliminar
      </Boton>

      {confirmando === 'estado' && (
        <Confirmar
          abierto
          titulo={`${producto.activo ? 'Desactivar' : 'Activar'} «${producto.nombre}»`}
          textoConfirmar={producto.activo ? 'Desactivar' : 'Activar'}
          peligro={producto.activo}
          cargando={estado.isPending}
          alConfirmar={() => estado.mutate()}
          alCancelar={cerrar}
        >
          <AvisoError error={estado.error} />
          <p>
            {producto.activo
              ? 'Deja de verse en la tienda y no se puede agregar al carrito. Los pedidos anteriores no cambian.'
              : 'Vuelve a verse en la tienda si su categoría está activa.'}
          </p>
        </Confirmar>
      )}
      {confirmando === 'eliminar' && (
        <Confirmar
          abierto
          titulo={`Eliminar «${producto.nombre}»`}
          textoConfirmar="Eliminar"
          peligro
          cargando={eliminar.isPending}
          alConfirmar={() => eliminar.mutate()}
          alCancelar={cerrar}
        >
          <AvisoError error={eliminar.error} />
          <p>
            Se borra con sus imágenes y variantes. Solo es posible si nunca tuvo ventas ni movimientos de inventario; si los tuvo,
            desactívelo.
          </p>
        </Confirmar>
      )}
    </>
  );
}

export function EditarProducto() {
  const { id } = useParams();
  const nuevo = id === undefined;
  const idProducto = Number(id);
  const valido = Number.isInteger(idProducto) && idProducto > 0;
  const soloLectura = !usePuedeEditarCatalogo();

  const consulta = useQuery({
    queryKey: ['producto-panel', idProducto],
    queryFn: ({ signal }) => obtenerProductoPanel(idProducto, signal),
    enabled: !nuevo && valido,
  });
  const producto = consulta.data;
  useTitulo(nuevo ? 'Nuevo producto' : producto?.nombre);

  const volver = (
    <Link to="/panel/productos" className={css.volver}>
      ← Productos
    </Link>
  );

  if (nuevo) {
    return (
      <>
        <EncabezadoPagina antetitulo={volver} titulo="Nuevo producto" descripcion="Después de crearlo podrá agregar sus variantes." />
        <Datos soloLectura={soloLectura} />
      </>
    );
  }

  if (!valido || (consulta.error instanceof ErrorApi && consulta.error.status === 404)) {
    return (
      <Vacio
        titulo="No encontramos este producto"
        accion={
          <BotonEnlace to="/panel/productos" variante="secundario">
            Ir a productos
          </BotonEnlace>
        }
      />
    );
  }
  if (consulta.isPending) return <Cargando texto="Cargando producto" />;
  if (consulta.error) return <ErrorVista error={consulta.error} alReintentar={() => void consulta.refetch()} />;
  if (!producto) return null;

  return (
    <>
      <EncabezadoPagina
        antetitulo={volver}
        titulo={producto.nombre}
        descripcion={
          <>
            <Insignia tono={producto.activo ? 'exito' : 'neutro'}>{producto.activo ? 'Activo' : 'Inactivo'}</Insignia>{' '}
            <span className="cifras">
              {producto.categoria} · Creado el {formatoFechaHora(producto.fechaCreacion)}
              {producto.fechaModificacion && ` · Modificado el ${formatoFechaHora(producto.fechaModificacion)}`}
            </span>
          </>
        }
        acciones={
          <>
            {producto.activo && (
              <BotonEnlace to={`/producto/${producto.id}`} target="_blank" variante="fantasma" chico>
                Ver en la tienda
              </BotonEnlace>
            )}
            {!soloLectura && <AccionesProducto producto={producto} />}
          </>
        }
      />
      {soloLectura && <p className={css.nota}>Solo el Administrador puede modificar el catálogo.</p>}
      {/* La key reinicia el formulario cuando el producto se guarda desde otra pestaña o se recarga. */}
      <Datos key={producto.fechaModificacion ?? producto.fechaCreacion} producto={producto} soloLectura={soloLectura} />
      <Variantes producto={producto} soloLectura={soloLectura} />
    </>
  );
}
