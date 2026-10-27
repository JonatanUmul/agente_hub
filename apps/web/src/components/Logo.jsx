import logo from '../assets/logo-ecofiltro.png';

// Logo oficial de Ecofiltro (azul). La clase `logo-marca` lo vuelve blanco en modo oscuro (ver index.css).
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <img src={logo} alt="Ecofiltro" className="logo-marca h-5 w-auto" />
      <span className="border-l border-borde-fuerte pl-2 text-xs font-medium uppercase tracking-wider text-tenue">
        Gestión
      </span>
    </span>
  );
}
