import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { z } from 'zod';
import type { Rol } from '../../../api/tipos';
import {
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  restablecerPassword,
  type UsuarioPanel,
} from '../../../api/usuarios';
import { ETIQUETA_ROL } from '../../../auth/roles';
import { useSesion } from '../../../auth/sesion';
import { useAvisos } from '../../../componentes/Avisos';
import { Boton } from '../../../componentes/Boton';
import { Entrada, Seleccion } from '../../../componentes/Campos';
import { EncabezadoPagina } from '../../../componentes/EncabezadoPagina';
import { AvisoError } from '../../../componentes/Estados';
import { BarraFiltros, CampoBusqueda, CampoSeleccion } from '../../../componentes/Filtros';
import { Insignia, type Tono } from '../../../componentes/Insignia';
import { Confirmar, Modal } from '../../../componentes/Modal';
import { Paginacion } from '../../../componentes/Paginacion';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { useListado } from '../../../hooks/useListado';
import { useTitulo } from '../../../hooks/useTitulo';
import { formatoFechaHora } from '../../../utils/formato';
import { erroresEnCampos } from '../../../utils/formularios';
import { passwordNueva, telefonoOpcional } from '../../../utils/validaciones';
import css from '../Administracion.module.css';

const ROLES: Rol[] = ['ADMIN', 'OPERADOR', 'CLIENTE'];
const TONO_ROL: Record<Rol, Tono> = { ADMIN: 'marca', OPERADOR: 'info', CLIENTE: 'neutro' };

const datos = {
  nombres: z.string().trim().min(1, 'Ingrese los nombres').max(100, 'Máximo 100 caracteres'),
  apellidos: z.string().trim().min(1, 'Ingrese los apellidos').max(100, 'Máximo 100 caracteres'),
  correo: z.string().trim().pipe(z.email('Ingrese un correo válido')),
  telefono: telefonoOpcional,
  rol: z.enum(['ADMIN', 'OPERADOR', 'CLIENTE']),
};

const esquemaCrear = z.object({ ...datos, password: passwordNueva });
const esquemaEditar = z.object({ ...datos, password: z.string() });
type Valores = z.infer<typeof esquemaCrear>;

const esquemaPassword = z
  .object({ password: passwordNueva, confirmacion: z.string() })
  .refine((d) => d.password === d.confirmacion, { message: 'Las contraseñas no coinciden', path: ['confirmacion'] });

function useAlCambiarUsuarios() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['panel-usuarios'] });
}

function FormularioUsuario({ usuario, esUstedMismo, alCerrar }: { usuario?: UsuarioPanel; esUstedMismo: boolean; alCerrar: () => void }) {
  const avisar = useAvisos();
  const alCambiar = useAlCambiarUsuarios();
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(usuario ? esquemaEditar : esquemaCrear),
    defaultValues: {
      nombres: usuario?.nombres ?? '',
      apellidos: usuario?.apellidos ?? '',
      correo: usuario?.correo ?? '',
      telefono: usuario?.telefono ?? '',
      rol: usuario?.rol ?? 'OPERADOR',
      password: '',
    },
  });

  async function enviar(v: Valores) {
    setErrorEnvio(null);
    const datosUsuario = { nombres: v.nombres, apellidos: v.apellidos, correo: v.correo, telefono: v.telefono || null, rol: v.rol };
    try {
      const guardado = usuario
        ? await actualizarUsuario(usuario.id, datosUsuario)
        : await crearUsuario({ ...datosUsuario, password: v.password });
      alCambiar();
      avisar('exito', usuario ? `Se guardaron los datos de ${guardado.nombres}.` : `Se creó la cuenta de ${guardado.nombres}.`);
      alCerrar();
    } catch (err) {
      if (!erroresEnCampos(err, setError, ['nombres', 'apellidos', 'correo', 'telefono', 'rol', 'password'])) setErrorEnvio(err);
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={usuario ? `Editar a ${usuario.nombres} ${usuario.apellidos}` : 'Nuevo usuario'}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={isSubmitting}>
            Volver
          </Boton>
          <Boton type="submit" form="form-usuario" cargando={isSubmitting}>
            {usuario ? 'Guardar cambios' : 'Crear usuario'}
          </Boton>
        </>
      }
    >
      <form id="form-usuario" className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
        <AvisoError error={errorEnvio} />
        <div className={css.dosColumnas}>
          <Entrada etiqueta="Nombres" autoFocus maxLength={100} error={errors.nombres?.message} {...register('nombres')} />
          <Entrada etiqueta="Apellidos" maxLength={100} error={errors.apellidos?.message} {...register('apellidos')} />
        </div>
        <Entrada etiqueta="Correo" type="email" maxLength={254} error={errors.correo?.message} {...register('correo')} />
        <div className={css.dosColumnas}>
          <Entrada
            etiqueta="Teléfono (opcional)"
            inputMode="numeric"
            maxLength={15}
            error={errors.telefono?.message}
            {...register('telefono')}
          />
          {esUstedMismo ? (
            // Un campo deshabilitado no se envía: el rol viaja oculto y se muestra como texto.
            <div className={css.dato}>
              <span>Rol</span>
              <p>{ETIQUETA_ROL[usuario?.rol ?? 'ADMIN']}</p>
              <p className={css.secundario}>No puede cambiar su propio rol.</p>
              <input type="hidden" {...register('rol')} />
            </div>
          ) : (
            <Seleccion etiqueta="Rol" error={errors.rol?.message} {...register('rol')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ETIQUETA_ROL[r]}
                </option>
              ))}
            </Seleccion>
          )}
        </div>
        {!usuario && (
          <Entrada
            etiqueta="Contraseña inicial"
            type="password"
            autoComplete="new-password"
            ayuda="Mínimo 8 caracteres, con letras y números. Compártala por un medio seguro."
            error={errors.password?.message}
            {...register('password')}
          />
        )}
      </form>
    </Modal>
  );
}

function CambiarPassword({ usuario, alCerrar }: { usuario: UsuarioPanel; alCerrar: () => void }) {
  const avisar = useAvisos();
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(esquemaPassword), defaultValues: { password: '', confirmacion: '' } });

  async function enviar(v: { password: string }) {
    setErrorEnvio(null);
    try {
      await restablecerPassword(usuario.id, v.password);
      avisar('exito', `Se cambió la contraseña de ${usuario.nombres}. Sus sesiones abiertas se cerraron.`);
      alCerrar();
    } catch (err) {
      setErrorEnvio(err);
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={`Contraseña de ${usuario.nombres} ${usuario.apellidos}`}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={isSubmitting}>
            Volver
          </Boton>
          <Boton type="submit" form="form-password" cargando={isSubmitting}>
            Cambiar contraseña
          </Boton>
        </>
      }
    >
      <form id="form-password" className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
        <AvisoError error={errorEnvio} />
        <p className={css.secundario}>
          Se cierran todas las sesiones de {usuario.correo}; tendrá que entrar de nuevo con la contraseña nueva.
        </p>
        <Entrada
          etiqueta="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          autoFocus
          ayuda="Mínimo 8 caracteres, con letras y números."
          error={errors.password?.message}
          {...register('password')}
        />
        <Entrada
          etiqueta="Repita la contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmacion?.message}
          {...register('confirmacion')}
        />
      </form>
    </Modal>
  );
}

function CambiarEstado({ usuario, alCerrar }: { usuario: UsuarioPanel; alCerrar: () => void }) {
  const avisar = useAvisos();
  const alCambiar = useAlCambiarUsuarios();
  const mutacion = useMutation({
    mutationFn: () => cambiarEstadoUsuario(usuario.id, !usuario.activo),
    onSuccess: (u) => {
      alCambiar();
      avisar('exito', `La cuenta de ${u.nombres} quedó ${u.activo ? 'activa' : 'inactiva'}.`);
      alCerrar();
    },
  });
  const desactivar = usuario.activo;

  return (
    <Confirmar
      abierto
      titulo={`${desactivar ? 'Desactivar' : 'Activar'} a ${usuario.nombres} ${usuario.apellidos}`}
      textoConfirmar={desactivar ? 'Desactivar' : 'Activar'}
      peligro={desactivar}
      cargando={mutacion.isPending}
      alConfirmar={() => mutacion.mutate()}
      alCancelar={alCerrar}
    >
      <AvisoError error={mutacion.error} />
      <p>
        {desactivar
          ? 'No podrá entrar y se cierran sus sesiones abiertas. Sus pedidos e historial se conservan.'
          : 'Podrá volver a entrar con su contraseña actual.'}
      </p>
    </Confirmar>
  );
}

type Accion = { tipo: 'nuevo' } | { tipo: 'editar' | 'password' | 'estado'; usuario: UsuarioPanel };

export function Usuarios() {
  useTitulo('Usuarios');
  const { usuario: actual } = useSesion();
  const [accion, setAccion] = useState<Accion | null>(null);
  const listado = useListado<UsuarioPanel>({
    clave: 'panel-usuarios',
    ruta: '/admin/usuarios',
    filtros: ['texto', 'rol', 'activo'],
    tamanio: 20,
  });
  const { filtros } = listado;

  const columnas: Columna<UsuarioPanel>[] = [
    {
      clave: 'nombre',
      titulo: 'Nombre',
      celda: (u) => (
        <>
          <span className={css.fuerte}>
            {u.nombres} {u.apellidos}
            {u.id === actual?.id && <span className={css.secundarioLinea}> (usted)</span>}
          </span>
          <span className={css.secundario}>{u.correo}</span>
        </>
      ),
    },
    { clave: 'rol', titulo: 'Rol', celda: (u) => <Insignia tono={TONO_ROL[u.rol]}>{ETIQUETA_ROL[u.rol]}</Insignia> },
    { clave: 'telefono', titulo: 'Teléfono', celda: (u) => <span className="cifras">{u.telefono ?? '—'}</span> },
    {
      clave: 'pedidos',
      titulo: 'Pedidos',
      alinear: 'derecha',
      celda: (u) =>
        u.cantidadPedidos > 0 ? <Link to={`/panel/pedidos?cliente=${encodeURIComponent(u.correo)}`}>{u.cantidadPedidos}</Link> : '—',
    },
    {
      clave: 'sesion',
      titulo: 'Última sesión',
      celda: (u) => <span className={`${css.secundarioLinea} cifras`}>{u.ultimaSesion ? formatoFechaHora(u.ultimaSesion) : 'Nunca'}</span>,
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (u) => <Insignia tono={u.activo ? 'exito' : 'neutro'}>{u.activo ? 'Activa' : 'Inactiva'}</Insignia>,
    },
    {
      clave: 'acciones',
      titulo: '',
      alinear: 'derecha',
      celda: (u) => (
        <span className={css.accionesFila}>
          <button type="button" onClick={() => setAccion({ tipo: 'editar', usuario: u })}>
            Editar
          </button>
          <button type="button" onClick={() => setAccion({ tipo: 'password', usuario: u })}>
            Contraseña
          </button>
          {u.id !== actual?.id && (
            <button type="button" onClick={() => setAccion({ tipo: 'estado', usuario: u })}>
              {u.activo ? 'Desactivar' : 'Activar'}
            </button>
          )}
          {u.rol !== 'CLIENTE' && <Link to={`/panel/bitacora?idUsuario=${u.id}`}>Actividad</Link>}
        </span>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion={listado.paginacion && `${listado.paginacion.total} ${listado.paginacion.total === 1 ? 'cuenta' : 'cuentas'}`}
        acciones={<Boton onClick={() => setAccion({ tipo: 'nuevo' })}>Nuevo usuario</Boton>}
      />

      <BarraFiltros>
        <CampoBusqueda
          etiqueta="Buscar"
          valor={filtros.texto ?? ''}
          placeholder="Nombre o correo"
          alCambiar={(texto) => listado.cambiarFiltros({ texto })}
        />
        <CampoSeleccion
          etiqueta="Rol"
          valor={filtros.rol ?? ''}
          opciones={[{ valor: '', etiqueta: 'Todos' }, ...ROLES.map((r) => ({ valor: r, etiqueta: ETIQUETA_ROL[r] }))]}
          alCambiar={(rol) => listado.cambiarFiltros({ rol })}
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
        claveFila={(u) => u.id}
        cargando={listado.cargando}
        error={listado.error}
        alReintentar={listado.recargar}
        actualizando={listado.actualizando}
        vacio={{ titulo: 'Sin usuarios', texto: 'No hay cuentas que coincidan con los filtros.' }}
      />
      {listado.paginacion && <Paginacion paginacion={listado.paginacion} alCambiar={listado.cambiarPagina} />}

      {accion?.tipo === 'nuevo' && <FormularioUsuario esUstedMismo={false} alCerrar={() => setAccion(null)} />}
      {accion?.tipo === 'editar' && (
        <FormularioUsuario usuario={accion.usuario} esUstedMismo={accion.usuario.id === actual?.id} alCerrar={() => setAccion(null)} />
      )}
      {accion?.tipo === 'password' && <CambiarPassword usuario={accion.usuario} alCerrar={() => setAccion(null)} />}
      {accion?.tipo === 'estado' && <CambiarEstado usuario={accion.usuario} alCerrar={() => setAccion(null)} />}
    </>
  );
}
