const VARIANTES = {
  primario: 'bg-emerald-700 text-white hover:bg-emerald-800',
  secundario: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  peligro: 'bg-red-700 text-white hover:bg-red-800',
  enlace: 'text-emerald-800 underline-offset-2 hover:underline',
};

export function Boton({
  variante = 'primario',
  cargando = false,
  className = '',
  children,
  ...props
}) {
  const base = variante === 'enlace' ? '' : 'rounded-md px-3 py-2 text-sm font-medium';
  return (
    <button
      type="button"
      disabled={cargando || props.disabled}
      className={`${base} ${VARIANTES[variante]} disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {cargando ? 'Guardando…' : children}
    </button>
  );
}
