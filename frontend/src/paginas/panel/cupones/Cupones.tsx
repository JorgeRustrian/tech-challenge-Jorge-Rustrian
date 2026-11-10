import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { obtenerCategoriasPanel } from '../../../api/catalogo';
import {
  actualizarCupon,
  cambiarEstadoCupon,
  crearCupon,
  eliminarCupon,
  ESTADOS_CUPON,
  type Cupon,
  type EstadoCupon,
} from '../../../api/cupones';
import { useAvisos } from '../../../componentes/Avisos';
import { Boton } from '../../../componentes/Boton';
import { AreaTexto, Entrada, Seleccion } from '../../../componentes/Campos';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { AvisoError } from '../../../componentes/Estados';
import { BarraFiltros, CampoBusqueda, CampoSeleccion } from '../../../componentes/Filtros';
import { Insignia, type Tono } from '../../../componentes/Insignia';
import { Confirmar, Modal } from '../../../componentes/Modal';
import { Paginacion } from '../../../componentes/Paginacion';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { useListado } from '../../../hooks/useListado';
import { useTitulo } from '../../../hooks/useTitulo';
import { aFechaHoraLocal, desdeFechaHoraLocal, formatoFechaHora, formatoMoneda } from '../../../utils/formato';
import { erroresEnCampos } from '../../../utils/formularios';
import css from '../Administracion.module.css';

const TONO_ESTADO: Record<EstadoCupon, Tono> = {
  VIGENTE: 'exito',
  PROGRAMADO: 'info',
  VENCIDO: 'neutro',
  AGOTADO: 'aviso',
  INACTIVO: 'neutro',
};

const entero = (mensaje: string) => z.string().trim().regex(/^\d+$/, mensaje);
const monto = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Monto con hasta dos decimales, por ejemplo 25.50');

const esquema = z
  .object({
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Mínimo 3 caracteres')
      .max(30, 'Máximo 30 caracteres')
      .regex(/^[A-Z0-9_-]+$/, 'Solo letras sin tilde, números, guion y guion bajo'),
    descripcion: z.string().trim().max(250, 'Máximo 250 caracteres'),
    tipoDescuento: z.enum(['PORCENTAJE', 'MONTO']),
    valor: monto.refine((v) => Number(v) > 0, 'Debe ser mayor que cero'),
    montoMinimo: monto,
    fechaInicio: z.string().min(1, 'Indique desde cuándo aplica'),
    fechaFin: z.string().min(1, 'Indique hasta cuándo aplica'),
    limiteUsosTotal: entero('Número entero mayor que cero').refine((v) => Number(v) >= 1, 'Debe ser al menos 1'),
    limiteUsosCliente: entero('Número entero mayor que cero').refine((v) => Number(v) >= 1, 'Debe ser al menos 1'),
    idCategoria: z.string(),
  })
  .refine((c) => c.tipoDescuento !== 'PORCENTAJE' || Number(c.valor) <= 100, {
    message: 'Un porcentaje no puede pasar de 100',
    path: ['valor'],
  })
  .refine((c) => !c.fechaInicio || !c.fechaFin || c.fechaFin > c.fechaInicio, {
    message: 'Debe ser posterior al inicio',
    path: ['fechaFin'],
  })
  .refine((c) => Number(c.limiteUsosCliente) <= Number(c.limiteUsosTotal), {
    message: 'No puede ser mayor que el límite total',
    path: ['limiteUsosCliente'],
  });

type Valores = z.infer<typeof esquema>;

const CAMPOS = [
  'codigo',
  'descripcion',
  'tipoDescuento',
  'valor',
  'montoMinimo',
  'fechaInicio',
  'fechaFin',
  'limiteUsosTotal',
  'limiteUsosCliente',
  'idCategoria',
] as const;

function descuento(c: Cupon) {
  return c.tipoDescuento === 'PORCENTAJE' ? `${c.valor} %` : formatoMoneda(c.valor);
}

function useAlCambiarCupones() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['panel-cupones'] });
}

function FormularioCupon({ cupon, alCerrar }: { cupon?: Cupon; alCerrar: () => void }) {
  const avisar = useAvisos();
  const alCambiar = useAlCambiarCupones();
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const categorias = useQuery({ queryKey: ['categorias-panel'], queryFn: ({ signal }) => obtenerCategoriasPanel(signal) });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: cupon?.codigo ?? '',
      descripcion: cupon?.descripcion ?? '',
      tipoDescuento: cupon?.tipoDescuento ?? 'PORCENTAJE',
      valor: cupon ? String(cupon.valor) : '',
      montoMinimo: cupon ? String(cupon.montoMinimo) : '0',
      fechaInicio: cupon ? aFechaHoraLocal(cupon.fechaInicio) : '',
      fechaFin: cupon ? aFechaHoraLocal(cupon.fechaFin) : '',
      limiteUsosTotal: cupon ? String(cupon.limiteUsosTotal) : '100',
      limiteUsosCliente: cupon ? String(cupon.limiteUsosCliente) : '1',
      idCategoria: cupon?.idCategoria ? String(cupon.idCategoria) : '',
    },
  });
  const tipo = useWatch({ control, name: 'tipoDescuento' });

  async function enviar(v: Valores) {
    setErrorEnvio(null);
    const datos = {
      codigo: v.codigo,
      descripcion: v.descripcion || null,
      tipoDescuento: v.tipoDescuento,
      valor: Number(v.valor),
      montoMinimo: Number(v.montoMinimo),
      fechaInicio: desdeFechaHoraLocal(v.fechaInicio),
      fechaFin: desdeFechaHoraLocal(v.fechaFin),
      limiteUsosTotal: Number(v.limiteUsosTotal),
      limiteUsosCliente: Number(v.limiteUsosCliente),
      idCategoria: v.idCategoria ? Number(v.idCategoria) : null,
    };
    try {
      const guardado = cupon ? await actualizarCupon(cupon.id, datos) : await crearCupon(datos);
      alCambiar();
      avisar('exito', cupon ? `Se guardó el cupón ${guardado.codigo}.` : `Se creó el cupón ${guardado.codigo}.`);
      alCerrar();
    } catch (err) {
      if (!erroresEnCampos(err, setError, CAMPOS)) setErrorEnvio(err);
    }
  }

  return (
    <Modal
      abierto
      ancho="amplio"
      alCerrar={alCerrar}
      titulo={cupon ? `Editar cupón ${cupon.codigo}` : 'Nuevo cupón'}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={isSubmitting}>
            Volver
          </Boton>
          <Boton type="submit" form="form-cupon" cargando={isSubmitting}>
            {cupon ? 'Guardar cambios' : 'Crear cupón'}
          </Boton>
        </>
      }
    >
      <form id="form-cupon" className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
        <AvisoError error={errorEnvio} />
        {cupon && cupon.usosActuales > 0 && (
          <p className={css.aviso}>
            Ya se usó {cupon.usosActuales} {cupon.usosActuales === 1 ? 'vez' : 'veces'}. Los cambios aplican a los próximos
            pedidos; los anteriores conservan el descuento que tuvieron.
          </p>
        )}
        <div className={css.dosColumnas}>
          <Entrada etiqueta="Código" maxLength={30} className={css.mayusculas} autoFocus error={errors.codigo?.message} {...register('codigo')} />
          <Seleccion etiqueta="Aplica a" error={errors.idCategoria?.message} {...register('idCategoria')}>
            <option value="">Toda la tienda</option>
            {(categorias.data ?? [])
              .filter((c) => c.activo || c.id === cupon?.idCategoria)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Solo {c.nombre}
                </option>
              ))}
          </Seleccion>
        </div>
        <AreaTexto
          etiqueta="Descripción (opcional)"
          rows={2}
          maxLength={250}
          ayuda="Solo la ve el personal."
          error={errors.descripcion?.message}
          {...register('descripcion')}
        />
        <div className={css.tresColumnas}>
          <Seleccion etiqueta="Tipo de descuento" {...register('tipoDescuento')}>
            <option value="PORCENTAJE">Porcentaje</option>
            <option value="MONTO">Monto fijo</option>
          </Seleccion>
          <Entrada
            etiqueta={tipo === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Monto (Q)'}
            inputMode="decimal"
            error={errors.valor?.message}
            {...register('valor')}
          />
          <Entrada
            etiqueta="Compra mínima (Q)"
            inputMode="decimal"
            ayuda="0 = sin mínimo"
            error={errors.montoMinimo?.message}
            {...register('montoMinimo')}
          />
        </div>
        <div className={css.dosColumnas}>
          <Entrada etiqueta="Desde" type="datetime-local" error={errors.fechaInicio?.message} {...register('fechaInicio')} />
          <Entrada etiqueta="Hasta" type="datetime-local" error={errors.fechaFin?.message} {...register('fechaFin')} />
        </div>
        <div className={css.dosColumnas}>
          <Entrada
            etiqueta="Usos en total"
            inputMode="numeric"
            ayuda={cupon ? `Lleva ${cupon.usosActuales}` : undefined}
            error={errors.limiteUsosTotal?.message}
            {...register('limiteUsosTotal')}
          />
          <Entrada
            etiqueta="Usos por cliente"
            inputMode="numeric"
            error={errors.limiteUsosCliente?.message}
            {...register('limiteUsosCliente')}
          />
        </div>
        <p className={css.secundario}>Las fechas están en hora de Guatemala.</p>
      </form>
    </Modal>
  );
}

type Accion = { tipo: 'nuevo' } | { tipo: 'editar' | 'estado' | 'eliminar'; cupon: Cupon };

function ConfirmarCupon({ tipo, cupon, alCerrar }: { tipo: 'estado' | 'eliminar'; cupon: Cupon; alCerrar: () => void }) {
  const avisar = useAvisos();
  const alCambiar = useAlCambiarCupones();
  const mutacion = useMutation({
    mutationFn: async () => {
      if (tipo === 'eliminar') await eliminarCupon(cupon.id);
      else await cambiarEstadoCupon(cupon.id, !cupon.activo);
    },
    onSuccess: () => {
      alCambiar();
      if (tipo === 'eliminar') avisar('exito', `Se eliminó el cupón ${cupon.codigo}.`);
      else avisar('exito', `El cupón ${cupon.codigo} quedó ${cupon.activo ? 'inactivo' : 'activo'}.`);
      alCerrar();
    },
  });

  const eliminar = tipo === 'eliminar';
  const verbo = eliminar ? 'Eliminar' : cupon.activo ? 'Desactivar' : 'Activar';
  return (
    <Confirmar
      abierto
      titulo={`${verbo} el cupón ${cupon.codigo}`}
      textoConfirmar={verbo}
      peligro={eliminar || cupon.activo}
      cargando={mutacion.isPending}
      alConfirmar={() => mutacion.mutate()}
      alCancelar={alCerrar}
    >
      <AvisoError error={mutacion.error} />
      <p>
        {eliminar
          ? 'Nunca se ha usado, así que se puede borrar de forma permanente.'
          : cupon.activo
            ? 'Deja de aceptarse. Si un cliente ya lo tiene en su carrito, se le avisa que dejó de ser válido antes de pagar.'
            : 'Se vuelve a aceptar mientras esté dentro de sus fechas y le queden usos.'}
      </p>
    </Confirmar>
  );
}

export function Cupones() {
  useTitulo('Cupones');
  const [accion, setAccion] = useState<Accion | null>(null);
  const listado = useListado<Cupon>({
    clave: 'panel-cupones',
    ruta: '/admin/cupones',
    filtros: ['texto', 'estado'],
    tamanio: 20,
  });
  const { filtros } = listado;

  const columnas: Columna<Cupon>[] = [
    {
      clave: 'codigo',
      titulo: 'Código',
      celda: (c) => (
        <>
          <span className={css.codigo}>{c.codigo}</span>
          {c.descripcion && <span className={css.secundario}>{c.descripcion}</span>}
        </>
      ),
    },
    {
      clave: 'descuento',
      titulo: 'Descuento',
      celda: (c) => (
        <>
          <span className={css.acento}>{descuento(c)}</span>
          {c.montoMinimo > 0 && <span className={css.secundario}>Mínimo {formatoMoneda(c.montoMinimo)}</span>}
        </>
      ),
    },
    { clave: 'aplica', titulo: 'Aplica a', celda: (c) => c.categoria ?? 'Toda la tienda' },
    {
      clave: 'vigencia',
      titulo: 'Vigencia',
      celda: (c) => (
        <span className={`${css.secundario} cifras`}>
          {formatoFechaHora(c.fechaInicio)}
          <br />
          {formatoFechaHora(c.fechaFin)}
        </span>
      ),
    },
    {
      clave: 'usos',
      titulo: 'Usos',
      alinear: 'derecha',
      celda: (c) => (
        <>
          {c.usosActuales} / {c.limiteUsosTotal}
          <span className={css.secundario}>{c.limiteUsosCliente} por cliente</span>
        </>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (c) => <Insignia tono={TONO_ESTADO[c.estado]}>{ESTADOS_CUPON.find((e) => e.valor === c.estado)?.etiqueta}</Insignia>,
    },
    {
      clave: 'acciones',
      titulo: '',
      alinear: 'derecha',
      celda: (c) => (
        <span className={css.accionesFila}>
          <button type="button" onClick={() => setAccion({ tipo: 'editar', cupon: c })}>
            Editar
          </button>
          <button type="button" onClick={() => setAccion({ tipo: 'estado', cupon: c })}>
            {c.activo ? 'Desactivar' : 'Activar'}
          </button>
          {c.usosActuales === 0 && (
            <button type="button" className={css.peligro} onClick={() => setAccion({ tipo: 'eliminar', cupon: c })}>
              Eliminar
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Cupones"
        descripcion={listado.paginacion && `${listado.paginacion.total} ${listado.paginacion.total === 1 ? 'cupón' : 'cupones'}`}
        acciones={<Boton onClick={() => setAccion({ tipo: 'nuevo' })}>Nuevo cupón</Boton>}
      />

      <BarraFiltros>
        <CampoBusqueda
          etiqueta="Buscar"
          valor={filtros.texto ?? ''}
          placeholder="Código o descripción"
          alCambiar={(texto) => listado.cambiarFiltros({ texto })}
        />
        <CampoSeleccion
          etiqueta="Estado"
          valor={filtros.estado ?? ''}
          opciones={[{ valor: '', etiqueta: 'Todos' }, ...ESTADOS_CUPON]}
          alCambiar={(estado) => listado.cambiarFiltros({ estado })}
        />
      </BarraFiltros>

      <Tabla
        columnas={columnas}
        filas={listado.datos}
        claveFila={(c) => c.id}
        cargando={listado.cargando}
        error={listado.error}
        alReintentar={listado.recargar}
        actualizando={listado.actualizando}
        vacio={{ titulo: 'Sin cupones', texto: 'No hay cupones que coincidan con los filtros.' }}
      />
      {listado.paginacion && <Paginacion paginacion={listado.paginacion} alCambiar={listado.cambiarPagina} />}

      {accion?.tipo === 'nuevo' && <FormularioCupon alCerrar={() => setAccion(null)} />}
      {accion?.tipo === 'editar' && <FormularioCupon cupon={accion.cupon} alCerrar={() => setAccion(null)} />}
      {(accion?.tipo === 'estado' || accion?.tipo === 'eliminar') && (
        <ConfirmarCupon tipo={accion.tipo} cupon={accion.cupon} alCerrar={() => setAccion(null)} />
      )}
    </>
  );
}
