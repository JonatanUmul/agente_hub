import { useSalud } from './hooks.js';

export function SaludPage() {
  const { data, isPending, error } = useSalud();

  if (isPending) return <p>Comprobando conexión…</p>;
  if (error) return <p className="text-red-700">API no disponible: {error.message}</p>;

  const ok = data.estado === 'ok';
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 font-medium">Estado del sistema</h2>
      <p className={ok ? 'text-green-700' : 'text-amber-700'}>
        API: en línea · Base de datos: {data.baseDatos === 'ok' ? 'conectada' : 'sin conexión'}
      </p>
    </section>
  );
}
