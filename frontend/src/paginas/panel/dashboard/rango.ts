import { useSearchParams } from 'react-router';
import type { Agrupacion, FiltroReporte } from '../../../api/reportes';
import { fechaLocalISO } from '../../../utils/formato';

const MS_DIA = 86_400_000;
const AGRUPACIONES: Agrupacion[] = ['dia', 'semana', 'mes'];

export function sumarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * MS_DIA).toISOString().slice(0, 10);
}

export function diasDelRango(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_DIA) + 1;
}

export function rangosRapidos(hoy: string) {
  return [
    { etiqueta: '7 días', fechaDesde: sumarDias(hoy, -6), fechaHasta: hoy },
    { etiqueta: '30 días', fechaDesde: sumarDias(hoy, -29), fechaHasta: hoy },
    { etiqueta: '90 días', fechaDesde: sumarDias(hoy, -89), fechaHasta: hoy },
    { etiqueta: 'Este mes', fechaDesde: `${hoy.slice(0, 8)}01`, fechaHasta: hoy },
    { etiqueta: 'Este año', fechaDesde: `${hoy.slice(0, 5)}01-01`, fechaHasta: hoy },
  ];
}

// Sin agrupación elegida se usa la que deja una cantidad razonable de barras.
function agrupacionSugerida(dias: number): Agrupacion {
  if (dias <= 45) return 'dia';
  if (dias <= 210) return 'semana';
  return 'mes';
}

type Cambios = Partial<Record<'fechaDesde' | 'fechaHasta' | 'entregados' | 'agrupacion', string | undefined>>;

// El rango vive en la URL igual que los filtros de los listados. Sin fechas, los últimos 30 días.
export function useFiltroReporte() {
  const [params, setParams] = useSearchParams();
  const hoy = fechaLocalISO(new Date());

  const filtro: FiltroReporte = {
    fechaDesde: params.get('fechaDesde') ?? sumarDias(params.get('fechaHasta') ?? hoy, -29),
    fechaHasta: params.get('fechaHasta') ?? hoy,
    soloEntregados: params.get('entregados') === '1',
  };
  const elegida = params.get('agrupacion') as Agrupacion | null;
  const agrupacion =
    elegida && AGRUPACIONES.includes(elegida) ? elegida : agrupacionSugerida(diasDelRango(filtro.fechaDesde, filtro.fechaHasta));

  function cambiar(cambios: Cambios) {
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales);
        for (const [nombre, valor] of Object.entries(cambios)) {
          if (valor) nuevos.set(nombre, valor);
          else nuevos.delete(nombre);
        }
        return nuevos;
      },
      { replace: true },
    );
  }

  return { hoy, filtro, agrupacion, cambiar };
}
