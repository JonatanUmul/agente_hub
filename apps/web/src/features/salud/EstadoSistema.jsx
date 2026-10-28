import { useSalud } from './hooks.js';

// Estado de la API y la base en una línea, arriba del inicio. Solo llama la atención si algo falla.
export function EstadoSistema() {
  const { data, isPending, error } = useSalud();

  if (isPending) return null;
  if (error)
    return (
      <p className="rounded-md border border-peligro/30 bg-peligro/10 px-3 py-2 text-sm text-peligro">
        API no disponible: {error.message}
      </p>
    );
  if (data.baseDatos !== 'ok')
    return (
      <p className="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm text-alerta">
        API en línea, pero sin conexión a la base de datos.
      </p>
    );
  return (
    <p className="flex items-center gap-2 text-xs text-tenue">
      <span className="h-2 w-2 rounded-full bg-acento" aria-hidden="true" />
      Sistema en línea · base de datos conectada
    </p>
  );
}
