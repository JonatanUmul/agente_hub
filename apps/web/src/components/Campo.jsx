// Etiqueta + control + mensaje de error. `children` es el input/select ya conectado a React Hook Form.
export function Campo({ etiqueta, error, ayuda, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-tenue">{etiqueta}</span>
      {children}
      {ayuda && !error && <span className="mt-1 block text-xs text-apagado">{ayuda}</span>}
      {error && <span className="mt-1 block text-xs text-peligro">{error.message}</span>}
    </label>
  );
}

const claseBase =
  'rounded-md border border-borde-fuerte bg-fondo px-3 py-1.5 text-sm text-texto placeholder:text-apagado transition-colors focus:border-acento focus:outline-none focus:ring-1 focus:ring-acento/40';

// Controles de formulario: ocupan todo el ancho de su columna.
export const claseControl = `w-full ${claseBase}`;
// Filtros de una tabla: ancho según su contenido, para que quepan varios en una fila.
export const claseFiltro = `${claseBase} h-8 py-1`;
