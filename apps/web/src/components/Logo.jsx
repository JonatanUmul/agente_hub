// Marca de la app: un cuadro verde con una gota (filtro de agua) y el nombre.
export function Logo({ compacto = false }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-acento/15 text-acento">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5c-.4 0-.8.2-1 .5C8.6 6.4 5.5 10.6 5.5 14a6.5 6.5 0 0 0 13 0c0-3.4-3.1-7.6-5.5-11-.2-.3-.6-.5-1-.5Z" />
        </svg>
      </span>
      {!compacto && (
        <span className="text-sm font-semibold tracking-tight">
          Ecofiltro <span className="font-normal text-tenue">Gestión</span>
        </span>
      )}
    </span>
  );
}
