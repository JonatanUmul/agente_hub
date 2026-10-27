// Etiqueta + control + mensaje de error. `children` es el input/select ya conectado a React Hook Form.
export function Campo({ etiqueta, error, ayuda, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{etiqueta}</span>
      {children}
      {ayuda && !error && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
      {error && <span className="mt-1 block text-xs text-red-700">{error.message}</span>}
    </label>
  );
}

const claseBase =
  'rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600';

// Controles de formulario: ocupan todo el ancho de su columna.
export const claseControl = `w-full ${claseBase}`;
// Filtros de una tabla: ancho según su contenido, para que quepan varios en una fila.
export const claseFiltro = `${claseBase} text-sm`;
