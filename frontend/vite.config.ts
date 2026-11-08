import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El proxy deja al front y a la API en el mismo origen: la cookie del refresh token
// (sameSite strict, path /api/auth) viaja sin configurar CORS en el navegador.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
