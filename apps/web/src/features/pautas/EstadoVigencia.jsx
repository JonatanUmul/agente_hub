const ESTILOS = {
  vigente: 'bg-emerald-50 text-emerald-800',
  programada: 'bg-sky-50 text-sky-800',
  vencida: 'bg-amber-50 text-amber-800',
  inactiva: 'bg-slate-100 text-slate-600',
};

export function EstadoVigencia({ estado }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTILOS[estado]}`}>
      {estado}
    </span>
  );
}
