import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { obtenerCarritosAbandonados, type CarritoAbandonado, type RespuestaCarritos } from '../../../api/reportes';
import { CampoSeleccion } from '../../../componentes/Filtros';
import { Paginacion } from '../../../componentes/Paginacion';
import { Tabla, type Columna } from '../../../componentes/Tabla';
import { formatoFechaHora, formatoMoneda } from '../../../utils/formato';
import css from './Dashboard.module.css';

const UMBRALES = [
  { valor: '1440', etiqueta: '24 horas' },
  { valor: '4320', etiqueta: '3 días' },
  { valor: '10080', etiqueta: '7 días' },
];

function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return minutos % 60 ? `${horas} h ${minutos % 60} min` : `${horas} h`;
  const dias = Math.floor(horas / 24);
  return horas % 24 ? `${dias} d ${horas % 24} h` : `${dias} d`;
}

function enPalabras(minutos: number): string {
  if (minutos >= 2880 && minutos % 1440 === 0) return `${minutos / 1440} días`;
  if (minutos % 60 === 0) return minutos === 60 ? '1 hora' : `${minutos / 60} horas`;
  return `${minutos} minutos`;
}

const COLUMNAS: Columna<CarritoAbandonado>[] = [
  {
    clave: 'cliente',
    titulo: 'Cliente',
    celda: (c) =>
      c.cliente ? (
        <>
          <span className={css.bloqueTexto}>{c.cliente.nombre}</span>
          <span className={css.secundario}>{c.cliente.correo}</span>
        </>
      ) : (
        <span className={css.secundario}>Invitado sin cuenta</span>
      ),
  },
  {
    clave: 'actividad',
    titulo: 'Última actividad',
    celda: (c) => <span className="cifras">{formatoFechaHora(c.ultimaActividad)}</span>,
  },
  { clave: 'inactivo', titulo: 'Sin actividad', celda: (c) => <span className="cifras">{duracion(c.minutosInactivo)}</span> },
  { clave: 'articulos', titulo: 'Art.', alinear: 'derecha', celda: (c) => c.articulos },
  { clave: 'monto', titulo: 'Monto estimado', alinear: 'derecha', celda: (c) => formatoMoneda(c.montoEstimado) },
];

export function CarritosAbandonados() {
  const queryClient = useQueryClient();
  // Vacío: el umbral configurado en la API (CARRITO_ABANDONADO_MINUTOS).
  const [umbral, setUmbral] = useState('');
  const [pagina, setPagina] = useState(1);
  const consulta = useQuery({
    queryKey: ['reporte', 'carritos-abandonados', umbral, pagina],
    queryFn: ({ signal }) => obtenerCarritosAbandonados(umbral ? Number(umbral) : undefined, pagina, signal),
    placeholderData: keepPreviousData,
  });
  const datos = consulta.data;
  const predeterminado = queryClient.getQueryData<RespuestaCarritos>(['reporte', 'carritos-abandonados', '', 1]);
  const opciones = [
    { valor: '', etiqueta: predeterminado ? enPalabras(predeterminado.minutosInactividad) : 'Predeterminado' },
    ...UMBRALES,
  ];

  return (
    <section className={css.tarjeta} id="carritos">
      <header className={css.cabeceraTarjeta}>
        <div>
          <h2>Carritos abandonados</h2>
          <p className={css.secundario}>
            Carritos con productos que nadie ha tocado
            {datos && ` en más de ${enPalabras(datos.minutosInactividad)}`}. Es una foto de este momento: no depende del
            rango de fechas.
          </p>
        </div>
        <CampoSeleccion
          etiqueta="Sin actividad por más de"
          valor={umbral}
          opciones={opciones}
          alCambiar={(v) => {
            setUmbral(v ?? '');
            setPagina(1);
          }}
        />
      </header>

      {datos && datos.paginacion.total > 0 && (
        <p className={css.totalCarritos}>
          <strong>{datos.paginacion.total}</strong> {datos.paginacion.total === 1 ? 'carrito' : 'carritos'} con{' '}
          <strong>{formatoMoneda(datos.montoTotal)}</strong> en productos
        </p>
      )}

      <Tabla
        columnas={COLUMNAS}
        filas={datos?.datos}
        claveFila={(c) => c.idCarrito}
        cargando={consulta.isPending}
        error={consulta.error}
        alReintentar={() => void consulta.refetch()}
        actualizando={consulta.isPlaceholderData}
        vacio={{ titulo: 'Sin carritos abandonados', texto: 'Ningún carrito con productos supera ese tiempo sin actividad.' }}
      />
      {datos && <Paginacion paginacion={datos.paginacion} alCambiar={setPagina} />}
    </section>
  );
}
