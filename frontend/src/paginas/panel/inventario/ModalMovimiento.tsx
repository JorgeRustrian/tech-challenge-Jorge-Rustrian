import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registrarAjuste, registrarEntrada, type Existencias } from '../../../api/inventario';
import { useAvisos } from '../../../componentes/Avisos';
import { Boton } from '../../../componentes/Boton';
import { AreaTexto, Entrada } from '../../../componentes/Campos';
import { AvisoError } from '../../../componentes/Estados';
import { Modal } from '../../../componentes/Modal';
import css from './Inventario.module.css';

export interface VarianteMovimiento {
  id: number;
  sku: string;
  descripcion: string;
  existencias: Existencias;
}

interface Props {
  tipo: 'entrada' | 'ajuste';
  variante: VarianteMovimiento;
  alCerrar: () => void;
}

export function ModalMovimiento({ tipo, variante, alCerrar }: Props) {
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const [sentido, setSentido] = useState<'sumar' | 'restar'>('sumar');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<{ cantidad?: string; motivo?: string }>({});

  const { fisica, reservada, disponible } = variante.existencias;
  const n = Math.round(Number(cantidad)) || 0;
  const resta = tipo === 'ajuste' && sentido === 'restar';
  const firmada = resta ? -n : n;

  const guardar = useMutation({
    mutationFn: () =>
      tipo === 'entrada' ? registrarEntrada(variante.id, n, motivo.trim()) : registrarAjuste(variante.id, firmada, motivo.trim()),
    onSuccess: ({ existencias }) => {
      void queryClient.invalidateQueries({ queryKey: ['existencias'] });
      void queryClient.invalidateQueries({ queryKey: ['kardex'] });
      avisar('exito', `${variante.sku}: ${firmada > 0 ? `+${firmada}` : `−${-firmada}`}. Existencia física: ${existencias.fisica}.`);
      alCerrar();
    },
  });

  function enviar() {
    const nuevos: typeof errores = {};
    if (!Number.isInteger(Number(cantidad)) || n < 1) nuevos.cantidad = 'Ingrese una cantidad entera mayor que cero.';
    else if (resta && n > disponible) nuevos.cantidad = `Solo se pueden restar ${disponible}: lo reservado no se toca.`;
    if (motivo.trim().length < 3) nuevos.motivo = 'Escriba el motivo (mínimo 3 caracteres).';
    setErrores(nuevos);
    if (Object.keys(nuevos).length === 0) guardar.mutate();
  }

  const titulo = tipo === 'entrada' ? 'Registrar entrada' : 'Registrar ajuste';

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={`${titulo} · ${variante.sku}`}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={guardar.isPending}>
            Volver
          </Boton>
          <Boton onClick={enviar} cargando={guardar.isPending}>
            {titulo}
          </Boton>
        </>
      }
    >
      <div className={css.formulario}>
        <AvisoError error={guardar.error} />
        <p className={css.secundario}>{variante.descripcion}</p>
        <dl className={`${css.existencias} cifras`}>
          <div>
            <dt>Física</dt>
            <dd>{fisica}</dd>
          </div>
          <div>
            <dt>Reservada</dt>
            <dd>{reservada}</dd>
          </div>
          <div>
            <dt>Disponible</dt>
            <dd>{disponible}</dd>
          </div>
        </dl>

        {tipo === 'ajuste' && (
          <fieldset className={css.sentido}>
            <legend>Tipo de ajuste</legend>
            <label>
              <input type="radio" name="sentido" checked={sentido === 'sumar'} onChange={() => setSentido('sumar')} />
              Sumar unidades
            </label>
            <label>
              <input type="radio" name="sentido" checked={sentido === 'restar'} onChange={() => setSentido('restar')} />
              Restar unidades
            </label>
          </fieldset>
        )}

        <Entrada
          etiqueta="Cantidad"
          inputMode="numeric"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))}
          error={errores.cantidad}
          ayuda={n > 0 ? `La existencia física queda en ${fisica + firmada}.` : undefined}
        />
        <AreaTexto
          etiqueta="Motivo"
          rows={2}
          maxLength={250}
          placeholder={tipo === 'entrada' ? 'Compra a proveedor, factura…' : 'Conteo físico, producto dañado…'}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          error={errores.motivo}
        />
      </div>
    </Modal>
  );
}
