import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { z } from 'zod';
import {
  actualizarCategoria,
  cambiarEstadoCategoria,
  crearCategoria,
  eliminarCategoria,
  obtenerCategoriasPanel,
  type Categoria,
  type DatosCategoria,
} from '../../../api/catalogo';
import { useAlCambiarCatalogo, usePuedeEditarCatalogo } from './comun';
import { useAvisos } from '../../../componentes/Avisos';
import { Boton } from '../../../componentes/Boton';
import { AreaTexto, Entrada } from '../../../componentes/Campos';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { AvisoError } from '../../../componentes/Estados';
import { Insignia } from '../../../componentes/Insignia';
import { Confirmar, Modal } from '../../../componentes/Modal';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { useTitulo } from '../../../hooks/useTitulo';
import { erroresEnCampos } from '../../../utils/formularios';
import css from './Catalogo.module.css';

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escriba el nombre').max(100, 'Máximo 100 caracteres'),
  descripcion: z.string().trim().max(500, 'Máximo 500 caracteres'),
});

type Valores = z.infer<typeof esquema>;

function FormularioCategoria({ categoria, alCerrar }: { categoria?: Categoria; alCerrar: () => void }) {
  const avisar = useAvisos();
  const alCambiar = useAlCambiarCatalogo();
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { nombre: categoria?.nombre ?? '', descripcion: categoria?.descripcion ?? '' },
  });

  async function enviar(v: Valores) {
    setErrorEnvio(null);
    const datos: DatosCategoria = { nombre: v.nombre, descripcion: v.descripcion || null };
    try {
      const guardada = categoria ? await actualizarCategoria(categoria.id, datos) : await crearCategoria(datos);
      alCambiar();
      avisar('exito', categoria ? `Se guardó «${guardada.nombre}».` : `Se creó la categoría «${guardada.nombre}».`);
      alCerrar();
    } catch (err) {
      if (!erroresEnCampos(err, setError, ['nombre', 'descripcion'])) setErrorEnvio(err);
    }
  }

  const titulo = categoria ? `Editar «${categoria.nombre}»` : 'Nueva categoría';
  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={titulo}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={isSubmitting}>
            Volver
          </Boton>
          <Boton type="submit" form="form-categoria" cargando={isSubmitting}>
            {categoria ? 'Guardar cambios' : 'Crear categoría'}
          </Boton>
        </>
      }
    >
      <form id="form-categoria" className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
        <AvisoError error={errorEnvio} />
        <Entrada etiqueta="Nombre" maxLength={100} autoFocus error={errors.nombre?.message} {...register('nombre')} />
        <AreaTexto
          etiqueta="Descripción (opcional)"
          rows={3}
          maxLength={500}
          error={errors.descripcion?.message}
          {...register('descripcion')}
        />
      </form>
    </Modal>
  );
}

type AccionConfirmada = { tipo: 'estado' | 'eliminar'; categoria: Categoria };
type Accion = AccionConfirmada | { tipo: 'editar'; categoria: Categoria } | { tipo: 'nueva' };

function ConfirmarAccion({ accion, alCerrar }: { accion: AccionConfirmada; alCerrar: () => void }) {
  const avisar = useAvisos();
  const alCambiar = useAlCambiarCatalogo();
  const { categoria } = accion;
  const desactivar = categoria.activo;

  const mutacion = useMutation({
    mutationFn: async () => {
      if (accion.tipo === 'eliminar') await eliminarCategoria(categoria.id);
      else await cambiarEstadoCategoria(categoria.id, !categoria.activo);
    },
    onSuccess: () => {
      alCambiar();
      if (accion.tipo === 'eliminar') avisar('exito', `Se eliminó la categoría «${categoria.nombre}».`);
      else avisar('exito', `«${categoria.nombre}» quedó ${desactivar ? 'inactiva' : 'activa'}.`);
      alCerrar();
    },
  });

  if (accion.tipo === 'eliminar') {
    return (
      <Confirmar
        abierto
        titulo={`Eliminar «${categoria.nombre}»`}
        textoConfirmar="Eliminar"
        peligro
        cargando={mutacion.isPending}
        alConfirmar={() => mutacion.mutate()}
        alCancelar={alCerrar}
      >
        <AvisoError error={mutacion.error} />
        <p>La categoría no tiene productos. Se borra de forma permanente.</p>
      </Confirmar>
    );
  }

  return (
    <Confirmar
      abierto
      titulo={`${desactivar ? 'Desactivar' : 'Activar'} «${categoria.nombre}»`}
      textoConfirmar={desactivar ? 'Desactivar' : 'Activar'}
      peligro={desactivar}
      cargando={mutacion.isPending}
      alConfirmar={() => mutacion.mutate()}
      alCancelar={alCerrar}
    >
      <AvisoError error={mutacion.error} />
      <p>
        {desactivar
          ? categoria.cantidadProductos > 0
            ? `Sus ${categoria.cantidadProductos} productos dejan de verse en la tienda hasta que la vuelva a activar. No se borra nada.`
            : 'Deja de aparecer en la tienda y no se le pueden asignar productos nuevos.'
          : 'Vuelve a aparecer en la tienda junto con sus productos activos.'}
      </p>
    </Confirmar>
  );
}

export function Categorias() {
  useTitulo('Categorías');
  const puedeEditar = usePuedeEditarCatalogo();
  const [accion, setAccion] = useState<Accion | null>(null);
  const consulta = useQuery({ queryKey: ['categorias-panel'], queryFn: ({ signal }) => obtenerCategoriasPanel(signal) });
  const categorias = consulta.data;

  const columnas: Columna<Categoria>[] = [
    {
      clave: 'nombre',
      titulo: 'Nombre',
      celda: (c) => (
        <>
          <span className={css.nombre}>{c.nombre}</span>
          {c.descripcion && <span className={css.secundario}>{c.descripcion}</span>}
        </>
      ),
    },
    {
      clave: 'productos',
      titulo: 'Productos',
      alinear: 'derecha',
      celda: (c) =>
        c.cantidadProductos > 0 ? <Link to={`/panel/productos?idCategoria=${c.id}`}>{c.cantidadProductos}</Link> : '0',
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (c) => <Insignia tono={c.activo ? 'exito' : 'neutro'}>{c.activo ? 'Activa' : 'Inactiva'}</Insignia>,
    },
  ];

  if (puedeEditar) {
    columnas.push({
      clave: 'acciones',
      titulo: '',
      alinear: 'derecha',
      celda: (c) => (
        <span className={css.accionesFila}>
          <button type="button" onClick={() => setAccion({ tipo: 'editar', categoria: c })}>
            Editar
          </button>
          <button type="button" onClick={() => setAccion({ tipo: 'estado', categoria: c })}>
            {c.activo ? 'Desactivar' : 'Activar'}
          </button>
          {c.cantidadProductos === 0 && (
            <button type="button" className={css.peligro} onClick={() => setAccion({ tipo: 'eliminar', categoria: c })}>
              Eliminar
            </button>
          )}
        </span>
      ),
    });
  }

  const activas = categorias?.filter((c) => c.activo).length ?? 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Categorías"
        descripcion={categorias && `${categorias.length} en total, ${activas} ${activas === 1 ? 'activa' : 'activas'}`}
        acciones={puedeEditar && <Boton onClick={() => setAccion({ tipo: 'nueva' })}>Nueva categoría</Boton>}
      />
      {puedeEditar && (
        <p className={css.nota}>
          Una categoría con productos no se puede eliminar: desactívela y sus productos dejarán de verse en la tienda.
        </p>
      )}

      <Tabla
        columnas={columnas}
        filas={categorias}
        claveFila={(c) => c.id}
        cargando={consulta.isPending}
        error={consulta.error}
        alReintentar={() => void consulta.refetch()}
        vacio={{ titulo: 'Sin categorías', texto: 'Cree la primera para empezar a cargar productos.' }}
      />

      {accion?.tipo === 'nueva' && <FormularioCategoria alCerrar={() => setAccion(null)} />}
      {accion?.tipo === 'editar' && <FormularioCategoria categoria={accion.categoria} alCerrar={() => setAccion(null)} />}
      {(accion?.tipo === 'estado' || accion?.tipo === 'eliminar') && (
        <ConfirmarAccion accion={accion} alCerrar={() => setAccion(null)} />
      )}
    </>
  );
}
