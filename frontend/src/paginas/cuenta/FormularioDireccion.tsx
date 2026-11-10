import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DEPARTAMENTOS, type DatosDireccion, type Direccion } from '../../api/direcciones';
import { useSesion } from '../../auth/sesion';
import { Boton } from '../../componentes/Boton';
import { AreaTexto, Casilla, Entrada, Seleccion } from '../../componentes/Campos';
import { AvisoError } from '../../componentes/Estados';
import { erroresEnCampos } from '../../utils/formularios';
import css from './FormularioDireccion.module.css';

const esquema = z.object({
  alias: z.string().trim().min(1, 'Póngale un nombre, por ejemplo «Casa»').max(50, 'Máximo 50 caracteres'),
  nombreDestinatario: z.string().trim().min(1, 'Indique quién recibe').max(150, 'Máximo 150 caracteres'),
  telefono: z.string().trim().regex(/^\d{8,15}$/, 'Solo números, entre 8 y 15 dígitos'),
  direccionLinea: z.string().trim().min(1, 'Ingrese la dirección').max(250, 'Máximo 250 caracteres'),
  zona: z.string(),
  municipio: z.string().trim().min(1, 'Ingrese el municipio').max(100, 'Máximo 100 caracteres'),
  departamento: z.string().min(1, 'Elija el departamento'),
  referencias: z.string().trim().max(250, 'Máximo 250 caracteres'),
  esPredeterminada: z.boolean(),
});

type Valores = z.infer<typeof esquema>;

const CAMPOS = [
  'alias',
  'nombreDestinatario',
  'telefono',
  'direccionLinea',
  'zona',
  'municipio',
  'departamento',
  'referencias',
] as const;

interface Props {
  inicial?: Direccion;
  // La primera dirección siempre queda como predeterminada, así que no se pregunta.
  preguntarPredeterminada?: boolean;
  textoGuardar?: string;
  alGuardar: (datos: DatosDireccion) => Promise<unknown>;
  alCancelar?: () => void;
}

export function FormularioDireccion({ inicial, preguntarPredeterminada, textoGuardar = 'Guardar dirección', alGuardar, alCancelar }: Props) {
  const { usuario } = useSesion();
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      alias: inicial?.alias ?? '',
      nombreDestinatario: inicial?.nombreDestinatario ?? (usuario ? `${usuario.nombres} ${usuario.apellidos}` : ''),
      telefono: inicial?.telefono ?? usuario?.telefono ?? '',
      direccionLinea: inicial?.direccionLinea ?? '',
      zona: inicial?.zona ? String(inicial.zona) : '',
      municipio: inicial?.municipio ?? '',
      departamento: inicial?.departamento ?? '',
      referencias: inicial?.referencias ?? '',
      esPredeterminada: false,
    },
  });

  async function enviar(v: Valores) {
    setErrorEnvio(null);
    try {
      await alGuardar({ ...v, zona: v.zona ? Number(v.zona) : null, referencias: v.referencias || null });
    } catch (err) {
      if (!erroresEnCampos(err, setError, CAMPOS)) setErrorEnvio(err);
    }
  }

  return (
    <form className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
      <AvisoError error={errorEnvio} />
      <div className={css.fila}>
        <Entrada etiqueta="Nombre de la dirección" placeholder="Casa, oficina…" error={errors.alias?.message} {...register('alias')} />
        <Entrada
          etiqueta="Quién recibe"
          autoComplete="name"
          error={errors.nombreDestinatario?.message}
          {...register('nombreDestinatario')}
        />
      </div>
      <Entrada
        etiqueta="Dirección"
        placeholder="4a. avenida 12-45, colonia o residencial"
        autoComplete="address-line1"
        error={errors.direccionLinea?.message}
        {...register('direccionLinea')}
      />
      <div className={css.filaTres}>
        <Seleccion etiqueta="Zona" error={errors.zona?.message} {...register('zona')}>
          <option value="">Sin zona</option>
          {Array.from({ length: 25 }, (_, i) => i + 1).map((z) => (
            <option key={z} value={z}>
              Zona {z}
            </option>
          ))}
        </Seleccion>
        <Entrada etiqueta="Municipio" error={errors.municipio?.message} {...register('municipio')} />
        <Seleccion etiqueta="Departamento" error={errors.departamento?.message} {...register('departamento')}>
          <option value="">Elija…</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Seleccion>
      </div>
      <Entrada
        etiqueta="Teléfono de contacto"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        error={errors.telefono?.message}
        {...register('telefono')}
      />
      <AreaTexto
        etiqueta="Referencias (opcional)"
        placeholder="Color de la casa, nivel, a la par de…"
        rows={2}
        error={errors.referencias?.message}
        {...register('referencias')}
      />
      {preguntarPredeterminada && <Casilla etiqueta="Usar como dirección predeterminada" {...register('esPredeterminada')} />}
      <div className={css.acciones}>
        {alCancelar && (
          <Boton variante="secundario" onClick={alCancelar} disabled={isSubmitting}>
            Cancelar
          </Boton>
        )}
        <Boton type="submit" cargando={isSubmitting}>
          {textoGuardar}
        </Boton>
      </div>
    </form>
  );
}
