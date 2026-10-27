import { NavLink, Outlet } from 'react-router-dom';
import { Boton } from '../components/Boton.jsx';
import { useCerrarSesion, usePermiso, useSesion } from '../features/auth/hooks.js';

const claseEnlace = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`;

export function Layout() {
  const { data: sesion } = useSesion();
  const salir = useCerrarSesion();
  const puedeGestionarUsuarios = usePermiso('usuarios:gestionar');

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-6 py-3">
          <h1 className="mr-4 text-lg font-semibold">Ecofiltro Gestión</h1>
          <nav className="flex flex-1 flex-wrap gap-1">
            <NavLink to="/" end className={claseEnlace}>
              Inicio
            </NavLink>
            <NavLink to="/productos" className={claseEnlace}>
              Productos
            </NavLink>
            <NavLink to="/pautas" className={claseEnlace}>
              Pautas
            </NavLink>
            <NavLink to="/multimedia" className={claseEnlace}>
              Multimedia
            </NavLink>
            <NavLink to="/interruptores" className={claseEnlace}>
              Interruptores
            </NavLink>
            {puedeGestionarUsuarios && (
              <NavLink to="/usuarios" className={claseEnlace}>
                Usuarios
              </NavLink>
            )}
          </nav>
          <NavLink to="/mi-cuenta" className={claseEnlace}>
            {sesion.usuario.nombre}
          </NavLink>
          <Boton variante="secundario" onClick={() => salir.mutate()} disabled={salir.isPending}>
            Salir
          </Boton>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
