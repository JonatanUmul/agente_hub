import { Link, NavLink, Outlet } from 'react-router-dom';
import { Boton } from '../components/Boton.jsx';
import { useCerrarSesion, usePermiso, useSesion } from '../features/auth/hooks.js';

const claseEnlace = ({ isActive }) =>
  `rounded-md px-2.5 py-2 text-sm ${isActive ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-slate-600 hover:bg-slate-100'}`;

export function Layout() {
  const { data: sesion } = useSesion();
  const salir = useCerrarSesion();
  const puedeGestionarUsuarios = usePermiso('usuarios:gestionar');

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <h1 className="mr-2 text-lg font-semibold">
            <Link to="/">Ecofiltro Gestión</Link>
          </h1>
          <nav className="order-last flex w-full flex-wrap gap-1 lg:order-none lg:w-auto lg:flex-1">
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
            <NavLink to="/reglas" className={claseEnlace}>
              Reglas
            </NavLink>
            <NavLink to="/preguntas" className={claseEnlace}>
              Preguntas
            </NavLink>
            <NavLink to="/que-ve-el-bot" className={claseEnlace}>
              ¿Qué ve el bot?
            </NavLink>
            <NavLink to="/auditoria" className={claseEnlace}>
              Historial
            </NavLink>
            {puedeGestionarUsuarios && (
              <NavLink to="/usuarios" className={claseEnlace}>
                Usuarios
              </NavLink>
            )}
          </nav>
          <div className="flex-1 lg:hidden" />
          <NavLink to="/mi-cuenta" className={claseEnlace}>
            {sesion.usuario.nombre}
          </NavLink>
          <Boton variante="secundario" onClick={() => salir.mutate()} disabled={salir.isPending}>
            Salir
          </Boton>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
