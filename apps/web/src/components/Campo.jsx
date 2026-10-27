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

export const claseControl =
  'w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600';
