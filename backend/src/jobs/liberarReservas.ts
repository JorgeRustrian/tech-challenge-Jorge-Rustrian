import { liberarReservasVencidas } from '../modulos/inventario/inventario.service';

const INTERVALO_MS = 60_000;

// RF-07: una reserva vencida libera la existencia sin intervención manual.
// Devuelve una función para detenerlo al apagar el servidor.
export function iniciarLiberacionDeReservas(): () => void {
  let enCurso = false;

  const ejecutar = async (): Promise<void> => {
    // Si una corrida tarda más que el intervalo, no se encima otra.
    if (enCurso) return;
    enCurso = true;
    try {
      const liberadas = await liberarReservasVencidas();
      if (liberadas > 0) {
        console.log(`Reservas vencidas liberadas: ${liberadas}`);
      }
    } catch (err) {
      console.error('Error al liberar reservas vencidas:', err);
    } finally {
      enCurso = false;
    }
  };

  void ejecutar();
  const temporizador = setInterval(() => void ejecutar(), INTERVALO_MS);

  return () => clearInterval(temporizador);
}
