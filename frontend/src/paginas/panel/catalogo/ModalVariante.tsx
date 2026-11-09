import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { actualizarVariante, crearVariante, type VariantePanel } from '../../../api/catalogo';
import { useAvisos } from '../../../componentes/Avisos';
import { Boton } from '../../../componentes/Boton';
import { Entrada } from '../../../componentes/Campos';
import { AvisoError } from '../../../componentes/Estados';
import { Modal } from '../../../componentes/Modal';
import { erroresEnCampos } from '../../../utils/formularios';
import css from './Catalogo.module.css';

const esquema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Escriba el SKU')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras sin tilde, números y guiones'),
  talla: z.string().trim().max(20, 'Máximo 20 caracteres'),
  color: z.string().trim().max(30, 'Máximo 30 caracteres'),
  precio: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Ingrese un monto con hasta dos decimales, por ejemplo 149.50')
    .refine((v) => Number(v) > 0, 'El precio debe ser mayor que cero'),
  existenciaInicial: z.string().trim().regex(/^\d*$/, 'Solo números enteros'),
});

type Valores = z.infer<typeof esquema>;

interface Props {
  idProducto: number;
  variante?: VariantePanel;
  alGuardar: () => void;
  alCerrar: () => void;
}

export function ModalVariante({ idProducto, variante, alGuardar, alCerrar }: Props) {
  const avisar = useAvisos();
  const [errorEnvio, setErrorEnvio] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      sku: variante?.sku ?? '',
      talla: variante?.talla ?? '',
      color: variante?.color ?? '',
      precio: variante ? variante.precio.toFixed(2) : '',
      existenciaInicial: '',
    },
  });

  async function enviar(v: Valores) {
    setErrorEnvio(null);
    const datos = { sku: v.sku, talla: v.talla || null, color: v.color || null, precio: Number(v.precio) };
    try {
      const guardada = variante
        ? await actualizarVariante(variante.id, datos)
        : await crearVariante(idProducto, { ...datos, existenciaInicial: Number(v.existenciaInicial || 0) });
      avisar('exito', variante ? `Se guardó la variante ${guardada.sku}.` : `Se agregó la variante ${guardada.sku}.`);
      alGuardar();
      alCerrar();
    } catch (err) {
      if (!erroresEnCampos(err, setError, ['sku', 'talla', 'color', 'precio', 'existenciaInicial'])) setErrorEnvio(err);
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={variante ? `Editar variante ${variante.sku}` : 'Nueva variante'}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={isSubmitting}>
            Volver
          </Boton>
          <Boton type="submit" form="form-variante" cargando={isSubmitting}>
            {variante ? 'Guardar cambios' : 'Agregar variante'}
          </Boton>
        </>
      }
    >
      <form id="form-variante" className={css.formulario} onSubmit={handleSubmit(enviar)} noValidate>
        <AvisoError error={errorEnvio} />
        <Entrada
          etiqueta="SKU"
          autoFocus
          maxLength={50}
          className={css.mayusculas}
          ayuda="Código único de la variante, por ejemplo POLO-M-AZU"
          error={errors.sku?.message}
          {...register('sku')}
        />
        <div className={css.dosColumnas}>
          <Entrada etiqueta="Talla (opcional)" maxLength={20} error={errors.talla?.message} {...register('talla')} />
          <Entrada etiqueta="Color (opcional)" maxLength={30} error={errors.color?.message} {...register('color')} />
        </div>
        <div className={css.dosColumnas}>
          <Entrada etiqueta="Precio (Q)" inputMode="decimal" error={errors.precio?.message} {...register('precio')} />
          {!variante && (
            <Entrada
              etiqueta="Existencia inicial"
              inputMode="numeric"
              placeholder="0"
              ayuda="Queda como entrada en el kardex"
              error={errors.existenciaInicial?.message}
              {...register('existenciaInicial')}
            />
          )}
        </div>
        {variante && (
          <p className={css.secundario}>
            La existencia no se edita aquí: se cambia con una entrada o un ajuste en Inventario, para que quede en el kardex.
          </p>
        )}
      </form>
    </Modal>
  );
}
