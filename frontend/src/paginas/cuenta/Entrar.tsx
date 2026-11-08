import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation } from 'react-router';
import { inicioSegunRol } from '../../auth/roles';
import { useSesion } from '../../auth/sesion';
import { Boton } from '../../componentes/Boton';
import { Entrada } from '../../componentes/Campos';
import { AvisoError } from '../../componentes/Estados';
import { erroresEnCampos } from '../../utils/formularios';
import css from './Formulario.module.css';

const esquema = z.object({
  correo: z.email('Ingrese un correo válido'),
  password: z.string().min(1, 'Ingrese su contraseña'),
});

type Datos = z.infer<typeof esquema>;

export function Entrar() {
  const { usuario, entrar } = useSesion();
  const ubicacion = useLocation();
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const desde = (ubicacion.state as { desde?: string } | null)?.desde;

  // Al entrar, el cambio de usuario vuelve a dibujar esta página y esta línea hace la redirección.
  if (usuario) return <Navigate to={desde ?? inicioSegunRol(usuario.rol)} replace />;

  async function enviar(datos: Datos) {
    setErrorEnvio(null);
    try {
      await entrar(datos);
    } catch (err) {
      if (!erroresEnCampos(err, setError, ['correo', 'password'])) setErrorEnvio(err);
    }
  }

  return (
    <section className={css.contenedor}>
      <h1>Entrar</h1>
      <p className={css.intro}>Con su cuenta puede pagar, guardar direcciones y seguir sus pedidos.</p>

      <form className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
        <AvisoError error={errorEnvio} />
        <Entrada etiqueta="Correo" type="email" autoComplete="email" error={errors.correo?.message} {...register('correo')} />
        <Entrada
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Boton type="submit" cargando={isSubmitting}>
          Entrar
        </Boton>
      </form>

      <p className={css.alterno}>
        ¿No tiene cuenta? <Link to="/registro">Cree una aquí</Link>
      </p>
    </section>
  );
}
