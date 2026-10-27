import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../features/auth/hooks.js';

// Sin sesión → /login, recordando a dónde quería ir. `permiso` opcional para páginas restringidas.
export function RutaProtegida() {
  const { data: sesion, isPending, error } = useSesion();
  const ubicacion = useLocation();

  if (isPending) return <p className="p-6 text-tenue">Cargando…</p>;
  if (error)
    return <p className="p-6 text-peligro">No se pudo contactar al servidor: {error.message}</p>;
  if (!sesion) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  return <Outlet />;
}

// Envuelve una página que exige un permiso concreto. La API también lo valida.
export function ConPermiso({ permitido, children }) {
  if (!permitido) return <p className="text-tenue">No tienes permiso para ver esta sección.</p>;
  return children;
}
