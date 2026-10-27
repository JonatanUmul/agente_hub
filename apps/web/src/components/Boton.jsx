const VARIANTES = {
  primario: 'border-acento/60 bg-acento text-black hover:bg-acento-hover',
  secundario: 'border-borde-fuerte bg-panel-2 text-texto hover:border-apagado hover:bg-borde',
  peligro: 'border-peligro/50 bg-peligro/10 text-peligro hover:bg-peligro/20',
  enlace: 'text-acento hover:underline underline-offset-2',
};

export function Boton({
  variante = 'primario',
  cargando = false,
  className = '',
  children,
  ...props
}) {
  const base =
    variante === 'enlace'
      ? 'text-sm'
      : 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors';
  return (
    <button
      type="button"
      disabled={cargando || props.disabled}
      className={`${base} ${VARIANTES[variante]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {cargando ? 'Guardando…' : children}
    </button>
  );
}
