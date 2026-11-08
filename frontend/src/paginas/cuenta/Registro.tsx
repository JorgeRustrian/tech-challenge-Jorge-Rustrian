import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation } from 'react-router';
import { ErrorApi } from '../../api/cliente';
import { inicioSegunRol } from '../../auth/roles';
import { useSesion } from '../../auth/sesion';
import { Boton } from '../../componentes/Boton';
import { Entrada } from '../../componentes/Campos';
import { AvisoError } from '../../componentes/Estados';
import { useTitulo } from '../../hooks/useTitulo';
import { erroresEnCampos } from '../../utils/formularios';
import css from './Formulario.module.css';

// Mismas reglas que valida la API, para avisar antes de enviar.
const esquema = z
  .object({
    nombres: z.string().trim().min(1, 'Ingrese sus nombres').max(100, 'Máximo 100 caracteres'),
    apellidos: z.string().trim().min(1, 'Ingrese sus apellidos').max(100, 'Máximo 100 caracteres'),
    correo: z.string().trim().pipe(z.email('Ingrese un correo válido')),
    telefono: z
      .string()
      .trim()
      .regex(/^(\d{8,15})?$/, 'Solo números, entre 8 y 15 dígitos'),
    password: z
      .string()
      .min(8, 'Use al menos 8 caracteres')
      .max(72, 'Use como máximo 72 caracteres')
      .regex(/[A-Za-z]/, 'Incluya al menos una letra')
      .regex(/\d/, 'Incluya al menos un número'),
    confirmacion: z.string(),
  })
  .refine((d) => d.password === d.confirmacion, { message: 'Las contraseñas no coinciden', path: ['confirmacion'] });

type Datos = z.infer<typeof esquema>;

const CAMPOS = ['nombres', 'apellidos', 'correo', 'telefono', 'password'] as const;

export function Registro() {
  const { usuario, registrarse } = useSesion();
  const ubicacion = useLocation();
  useTitulo('Crear cuenta');
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const desde = (ubicacion.state as { desde?: string } | null)?.desde;

  if (usuario) return <Navigate to={desde ?? inicioSegunRol(usuario.rol)} replace />;

  async function enviar({ nombres, apellidos, correo, telefono, password }: Datos) {
    setErrorEnvio(null);
    try {
      await registrarse({ nombres, apellidos, correo, password, telefono: telefono || undefined });
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 409) {
        setError('correo', { message: 'Ya existe una cuenta con este correo.' });
        return;
      }
      if (!erroresEnCampos(err, setError, CAMPOS)) setErrorEnvio(err);
    }
  }

  return (
    <section className={css.contenedor}>
      <h1>Crear cuenta</h1>
      <p className={css.intro}>Solo le pedimos lo necesario para entregarle sus pedidos.</p>

      <form className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
        <AvisoError error={errorEnvio} />
        <div className={css.fila}>
          <Entrada etiqueta="Nombres" autoComplete="given-name" error={errors.nombres?.message} {...register('nombres')} />
          <Entrada etiqueta="Apellidos" autoComplete="family-name" error={errors.apellidos?.message} {...register('apellidos')} />
        </div>
        <Entrada etiqueta="Correo" type="email" autoComplete="email" error={errors.correo?.message} {...register('correo')} />
        <Entrada
          etiqueta="Teléfono (opcional)"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          error={errors.telefono?.message}
          {...register('telefono')}
        />
        <Entrada
          etiqueta="Contraseña"
          type="password"
          autoComplete="new-password"
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
        <Boton type="submit" cargando={isSubmitting}>
          Crear cuenta
        </Boton>
      </form>

      <p className={css.alterno}>
        ¿Ya tiene cuenta?{' '}
        <Link to="/entrar" state={ubicacion.state}>
          Entre aquí
        </Link>
      </p>
    </section>
  );
}
