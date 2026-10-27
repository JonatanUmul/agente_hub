// Interruptor accesible (role="switch"). No cambia solo: avisa con alCambiar para que la página confirme.
export function Toggle({ activo, alCambiar, deshabilitado = false, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={() => alCambiar(!activo)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        activo ? 'border-acento bg-acento' : 'border-borde-fuerte bg-panel-2'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full shadow transition-transform ${
          activo ? 'translate-x-[18px] bg-sobre-acento' : 'translate-x-0.5 bg-tenue'
        }`}
      />
    </button>
  );
}
