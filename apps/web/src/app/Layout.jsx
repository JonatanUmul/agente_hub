import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BotonTema } from '../components/BotonTema.jsx';
import { Icono } from '../components/Icono.jsx';
import { Logo } from '../components/Logo.jsx';
import { useCerrarSesion, usePermiso, useSesion } from '../features/auth/hooks.js';

// Menú lateral agrupado por área. `permiso` opcional: el enlace solo se muestra a quien lo tiene
// (la API vuelve a verificarlo).
const SECCIONES = [
  {
    titulo: 'Catálogo',
    enlaces: [
      { ruta: '/productos', texto: 'Productos', icono: 'paquete' },
      { ruta: '/pautas', texto: 'Pautas', icono: 'etiqueta' },
      { ruta: '/multimedia', texto: 'Multimedia', icono: 'imagen' },
    ],
  },
  {
    titulo: 'Bot',
    enlaces: [
      { ruta: '/interruptores', texto: 'Interruptores', icono: 'interruptor' },
      { ruta: '/reglas', texto: 'Reglas', icono: 'lista' },
      { ruta: '/preguntas', texto: 'Preguntas frecuentes', icono: 'pregunta' },
      { ruta: '/horarios', texto: 'Horarios de agentes', icono: 'reloj' },
      { ruta: '/que-ve-el-bot', texto: '¿Qué ve el bot?', icono: 'bot' },
    ],
  },
  {
    titulo: 'Administración',
    enlaces: [
      { ruta: '/auditoria', texto: 'Historial', icono: 'historial' },
      { ruta: '/usuarios', texto: 'Usuarios', icono: 'usuarios', permiso: 'usuarios:gestionar' },
    ],
  },
];

const claseEnlace = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
    isActive ? 'bg-panel-2 text-texto' : 'text-tenue hover:bg-panel-2/60 hover:text-texto'
  }`;

export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <div className="flex min-h-screen">
      {/* Fondo oscuro detrás del menú en pantallas angostas. */}
      {menuAbierto && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={cerrarMenu} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-borde bg-panel transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-borde px-4">
          <Link to="/" onClick={cerrarMenu}>
            <Logo />
          </Link>
          <button
            onClick={cerrarMenu}
            className="text-tenue hover:text-texto lg:hidden"
            aria-label="Cerrar menú"
          >
            <Icono nombre="cerrar" />
          </button>
        </div>
        <Navegacion alNavegar={cerrarMenu} />
        <PieUsuario alNavegar={cerrarMenu} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo en pantallas angostas. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-borde bg-panel/95 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setMenuAbierto(true)}
            className="text-tenue hover:text-texto"
            aria-label="Abrir menú"
          >
            <Icono nombre="menu" className="h-5 w-5" />
          </button>
          <Logo />
          <BotonTema className="ml-auto" />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Navegacion({ alNavegar }) {
  const puedeGestionarUsuarios = usePermiso('usuarios:gestionar');
  const permisos = { 'usuarios:gestionar': puedeGestionarUsuarios };

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      <NavLink to="/" end className={claseEnlace} onClick={alNavegar}>
        <Icono nombre="grafico" /> Inicio · reportes
      </NavLink>
      {SECCIONES.map((seccion) => (
        <div key={seccion.titulo}>
          <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-apagado">
            {seccion.titulo}
          </p>
          <div className="space-y-0.5">
            {seccion.enlaces
              .filter((e) => !e.permiso || permisos[e.permiso])
              .map((e) => (
                <NavLink key={e.ruta} to={e.ruta} className={claseEnlace} onClick={alNavegar}>
                  <Icono nombre={e.icono} /> {e.texto}
                </NavLink>
              ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function PieUsuario({ alNavegar }) {
  const { data: sesion } = useSesion();
  const salir = useCerrarSesion();
  const { nombre, rol } = sesion.usuario;

  return (
    <div className="flex items-center gap-2 border-t border-borde p-3">
      <Link
        to="/mi-cuenta"
        onClick={alNavegar}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 hover:bg-panel-2"
        title="Mi cuenta"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-acento/15 text-xs font-semibold uppercase text-acento">
          {nombre.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm">{nombre}</span>
          <span className="block font-mono text-[11px] text-apagado">{rol}</span>
        </span>
      </Link>
      <BotonTema />
      <button
        onClick={() => salir.mutate()}
        disabled={salir.isPending}
        className="rounded-md p-2 text-tenue hover:bg-panel-2 hover:text-texto"
        title="Salir"
        aria-label="Salir"
      >
        <Icono nombre="salir" />
      </button>
    </div>
  );
}
