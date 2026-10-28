import { DIAS_SEMANA, entero } from './formato.js';

// Mapa de calor día × hora de los mensajes de la bandeja. Un solo tono (serie 1), de claro a oscuro:
// 5 niveles mezclando el color con el fondo del panel. 0 mensajes = celda vacía.
const NIVELES = [18, 36, 56, 78, 100];
const colorNivel = (pct) => `color-mix(in oklab, var(--serie-1) ${pct}%, var(--panel))`;
const HORAS = Array.from({ length: 24 }, (_, h) => h);

export function MapaCalor({ horasPico }) {
  const valor = new Map(horasPico.map((c) => [`${c.diaSemana}-${c.hora}`, c.mensajes]));
  const maximo = Math.max(0, ...horasPico.map((c) => c.mensajes));
  const nivel = (n) => (n ? NIVELES[Math.min(4, Math.floor((n / maximo) * 5))] : 0);

  if (maximo === 0) return <p className="text-sm text-apagado">Sin mensajes en el periodo.</p>;
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[560px] gap-0.5 text-[10px] text-apagado"
        style={{ gridTemplateColumns: '2.5rem repeat(24, minmax(0, 1fr))' }}
        role="table"
        aria-label="Mensajes por día de la semana y hora"
      >
        <span />
        {HORAS.map((h) => (
          <span key={h} className="text-center">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
        {DIAS_SEMANA.map((dia, i) => (
          <div key={dia} className="contents" role="row">
            <span className="self-center">{dia}</span>
            {HORAS.map((h) => {
              const n = valor.get(`${i + 1}-${h}`) ?? 0;
              const etiqueta = `${dia} ${h}:00 – ${entero(n)} mensaje(s)`;
              return (
                <span
                  key={h}
                  role="cell"
                  title={etiqueta}
                  aria-label={etiqueta}
                  className="h-5 rounded-[3px] hover:outline hover:outline-1 hover:outline-texto"
                  style={{ background: n ? colorNivel(nivel(n)) : 'var(--panel-2)' }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-tenue">
        Menos
        {NIVELES.map((pct) => (
          <span
            key={pct}
            className="h-3 w-4 rounded-[3px]"
            style={{ background: colorNivel(pct) }}
          />
        ))}
        Más · máximo {entero(maximo)} mensajes en una hora
      </div>
    </div>
  );
}
