import { app } from './app';
import { env } from './config/env';
import { obtenerPool, cerrarPool } from './db/conexion';
import { iniciarLiberacionDeReservas } from './jobs/liberarReservas';

async function iniciar(): Promise<void> {
  await obtenerPool();

  const detenerLiberacion = iniciarLiberacionDeReservas();

  const servidor = app.listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT}`);
    console.log(`Documentacion: http://localhost:${env.PORT}/api/docs`);
  });

  const apagar = async (): Promise<void> => {
    detenerLiberacion();
    servidor.close();
    await cerrarPool();
    process.exit(0);
  };

  process.on('SIGINT', () => void apagar());
  process.on('SIGTERM', () => void apagar());
}

iniciar().catch((err: unknown) => {
  console.error('No se pudo iniciar la API:', err);
  process.exit(1);
});
