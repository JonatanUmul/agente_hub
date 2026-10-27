const ESTILOS = {
  vigente: 'border-acento/30 bg-acento/10 text-acento',
  programada: 'border-info/30 bg-info/10 text-info',
  vencida: 'border-alerta/30 bg-alerta/10 text-alerta',
  inactiva: 'border-borde-fuerte bg-panel-2 text-tenue',
};

export function EstadoVigencia({ estado }) {
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[11px] ${ESTILOS[estado]}`}
    >
      {estado}
    </span>
  );
}
