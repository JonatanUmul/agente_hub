import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { configurarAlNoAutenticado, guardarCsrfToken } from '../lib/api.js';
import { CLAVE_SESION } from '../features/auth/hooks.js';

const queryClient = new QueryClient({
  defaultOptions: {
    // Los datos los cambia más de una persona: preferimos refrescar al volver a la pestaña.
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

// Si cualquier petición responde 401 (sesión vencida o cerrada en otro lado), marcamos la sesión
// como inexistente; RutaProtegida redirige al login.
configurarAlNoAutenticado(() => {
  guardarCsrfToken(null);
  queryClient.setQueryData(CLAVE_SESION, null);
});

export function Proveedores({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}
