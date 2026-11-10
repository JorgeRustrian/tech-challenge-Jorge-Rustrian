import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  actualizarDireccion,
  CLAVE_DIRECCIONES,
  crearDireccion,
  eliminarDireccion,
  lineaDireccion,
  marcarPredeterminada,
  type DatosDireccion,
  type Direccion,
} from '../../api/direcciones';
import { useAvisos } from '../../componentes/Avisos';
import { Boton } from '../../componentes/Boton';
import { EncabezadoPagina } from '../../componentes/EncabezadoPagina';
import { Cargando, ErrorVista, mensajeDeError, Vacio } from '../../componentes/Estados';
import { Insignia } from '../../componentes/Insignia';
import { Confirmar, Modal } from '../../componentes/Modal';
import { useDirecciones } from '../../hooks/useDirecciones';
import { useTitulo } from '../../hooks/useTitulo';
import { FormularioDireccion } from './FormularioDireccion';
import css from './Direcciones.module.css';

const MAXIMO = 10;

type Edicion = { tipo: 'nueva' } | { tipo: 'editar'; direccion: Direccion } | null;

export function Direcciones() {
  useTitulo('Direcciones');
  const queryClient = useQueryClient();
  const avisar = useAvisos();
  const direcciones = useDirecciones();
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [porEliminar, setPorEliminar] = useState<Direccion | null>(null);

  const recargar = () => queryClient.invalidateQueries({ queryKey: CLAVE_DIRECCIONES });

  const predeterminada = useMutation({
    mutationFn: marcarPredeterminada,
    onSuccess: (lista) => {
      queryClient.setQueryData(CLAVE_DIRECCIONES, lista);
      avisar('exito', 'Se cambió la dirección predeterminada.');
    },
    onError: (err) => avisar('error', mensajeDeError(err)),
  });

  const eliminar = useMutation({
    mutationFn: eliminarDireccion,
    onSuccess: () => {
      setPorEliminar(null);
      avisar('exito', 'Se eliminó la dirección.');
      return recargar();
    },
    onError: (err) => {
      setPorEliminar(null);
      avisar('error', mensajeDeError(err));
    },
  });

  async function guardar(datos: DatosDireccion) {
    if (edicion?.tipo === 'editar') {
      await actualizarDireccion(edicion.direccion.id, datos);
      avisar('exito', 'Se guardaron los cambios.');
    } else {
      await crearDireccion(datos);
      avisar('exito', 'Se agregó la dirección.');
    }
    setEdicion(null);
    await recargar();
  }

  const lista = direcciones.data ?? [];
  const lleno = lista.length >= MAXIMO;

  let contenido;
  if (direcciones.isPending) contenido = <Cargando texto="Cargando direcciones" />;
  else if (direcciones.error) contenido = <ErrorVista error={direcciones.error} alReintentar={() => void direcciones.refetch()} />;
  else if (lista.length === 0)
    contenido = (
      <Vacio
        titulo="Todavía no tiene direcciones"
        texto="Agregue una para recibir sus pedidos."
        accion={<Boton onClick={() => setEdicion({ tipo: 'nueva' })}>Agregar dirección</Boton>}
      />
    );
  else
    contenido = (
      <ul className={css.lista}>
        {lista.map((d) => (
          <li key={d.id} className={`${css.tarjeta} ${d.esPredeterminada ? css.principal : ''}`}>
            <div className={css.titulo}>
              <h2>{d.alias}</h2>
              {d.esPredeterminada && <Insignia tono="marca">Predeterminada</Insignia>}
            </div>
            <p>{d.nombreDestinatario}</p>
            <p className={css.texto}>{lineaDireccion(d)}</p>
            {d.referencias && <p className={css.texto}>{d.referencias}</p>}
            <p className={`${css.texto} cifras`}>Tel. {d.telefono}</p>
            <div className={css.acciones}>
              <Boton variante="secundario" chico onClick={() => setEdicion({ tipo: 'editar', direccion: d })}>
                Editar
              </Boton>
              {!d.esPredeterminada && (
                <Boton
                  variante="fantasma"
                  chico
                  onClick={() => predeterminada.mutate(d.id)}
                  cargando={predeterminada.isPending && predeterminada.variables === d.id}
                >
                  Usar como predeterminada
                </Boton>
              )}
              <Boton variante="fantasma" chico className={css.eliminar} onClick={() => setPorEliminar(d)}>
                Eliminar
              </Boton>
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <EncabezadoPagina
        titulo="Direcciones"
        descripcion={
          lista.length > 0 &&
          `${lista.length} de ${MAXIMO}. La predeterminada se propone primero al pagar; cada pedido guarda su propia copia.`
        }
        acciones={
          lista.length > 0 && (
            <Boton onClick={() => setEdicion({ tipo: 'nueva' })} disabled={lleno} title={lleno ? `Máximo ${MAXIMO} direcciones` : undefined}>
              Agregar dirección
            </Boton>
          )
        }
      />
      {contenido}

      <Modal
        abierto={edicion !== null}
        alCerrar={() => setEdicion(null)}
        titulo={edicion?.tipo === 'editar' ? `Editar «${edicion.direccion.alias}»` : 'Nueva dirección'}
        ancho="amplio"
      >
        {edicion && (
          <FormularioDireccion
            inicial={edicion.tipo === 'editar' ? edicion.direccion : undefined}
            preguntarPredeterminada={edicion.tipo === 'nueva' && lista.length > 0}
            alGuardar={guardar}
            alCancelar={() => setEdicion(null)}
          />
        )}
      </Modal>

      <Confirmar
        abierto={porEliminar !== null}
        titulo="¿Eliminar esta dirección?"
        textoConfirmar="Eliminar"
        peligro
        cargando={eliminar.isPending}
        alCancelar={() => setPorEliminar(null)}
        alConfirmar={() => porEliminar && eliminar.mutate(porEliminar.id)}
      >
        {porEliminar && (
          <p>
            Se eliminará «{porEliminar.alias}». Los pedidos que ya hizo a esta dirección no cambian.
            {porEliminar.esPredeterminada && ' La dirección más reciente pasará a ser la predeterminada.'}
          </p>
        )}
      </Confirmar>
    </>
  );
}
