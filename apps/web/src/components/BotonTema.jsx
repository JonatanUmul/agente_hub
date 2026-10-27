import { useTema } from '../lib/tema.js';
import { Icono } from './Icono.jsx';

export function BotonTema({ className = '' }) {
  const { tema, alternar } = useTema();
  const siguiente = tema === 'oscuro' ? 'claro' : 'oscuro';
  return (
    <button
      type="button"
      onClick={alternar}
      title={`Cambiar a modo ${siguiente}`}
      aria-label={`Cambiar a modo ${siguiente}`}
      className={`rounded-md p-2 text-tenue hover:bg-panel-2 hover:text-texto ${className}`}
    >
      <Icono nombre={tema === 'oscuro' ? 'sol' : 'luna'} />
    </button>
  );
}
