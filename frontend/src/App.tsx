import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { ErrorApi } from './api/cliente';
import { SesionProvider } from './auth/sesion';
import { AvisosProvider } from './componentes/Avisos';
import { router } from './rutas';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Un 4xx no se arregla reintentando; una caída de red o un 5xx sí puede.
      retry: (intentos, error) => intentos < 1 && !(error instanceof ErrorApi && error.status >= 400 && error.status < 500),
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AvisosProvider>
        <SesionProvider>
          <RouterProvider router={router} />
        </SesionProvider>
      </AvisosProvider>
    </QueryClientProvider>
  );
}
