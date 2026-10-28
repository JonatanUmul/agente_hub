import { NOMBRES_MODULO_SALUDO, vigenteEn } from '@ecofiltro/shared';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MS_DIA = 86_400_000;

// Días del año como 'YYYY-MM-DD'.
function diasDelAnio(anio) {
  const dias = [];
  for (let t = Date.UTC(anio, 0, 1); t < Date.UTC(anio + 1, 0, 1); t += MS_DIA) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

// Tramos seguidos en que aplica el saludo: [[inicio, largo], …] en índices de día.
function tramos(saludo, dias) {
  const lista = [];
  dias.forEach((d, i) => {
    if (!vigenteEn(saludo, d)) return;
    const ultimo = lista.at(-1);
    if (ultimo && ultimo[0] + ultimo[1] === i) ultimo[1] += 1;
    else lista.push([i, 1]);
  });
  return lista;
}

// Temporadas activas del año en curso, para ver huecos y choques.
export function LineaTiempo({ saludos, hoy }) {
  const anio = Number(hoy.slice(0, 4));
  const dias = diasDelAnio(anio);
  const temporadas = saludos.filter((s) => s.activo && s.fechaInicio !== null);
  const pct = (i) => `${(i / dias.length) * 100}%`;
  const hoyIndice = dias.indexOf(hoy);

  return (
    <div className="space-y-2 rounded-lg border border-borde bg-panel p-4">
      <h3 className="font-medium">Temporadas {anio}</h3>
      {temporadas.length === 0 ? (
        <p className="text-sm text-apagado">Sin temporadas activas.</p>
      ) : (
        <div className="space-y-1">
          <div className="relative ml-40 flex text-[10px] text-apagado">
            {MESES.map((m) => (
              <span key={m} className="flex-1">
                {m}
              </span>
            ))}
          </div>
          {temporadas.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="w-38 shrink-0 truncate" title={s.nombre}>
                {s.nombre} <span className="text-apagado">· {NOMBRES_MODULO_SALUDO[s.modulo]}</span>
              </span>
              <div className="relative h-3 flex-1 rounded bg-panel-2">
                {tramos(s, dias).map(([inicio, largo]) => (
                  <span
                    key={inicio}
                    title={`${s.nombre}: ${dias[inicio]} a ${dias[inicio + largo - 1]}`}
                    className="absolute inset-y-0 rounded bg-serie-1"
                    style={{ left: pct(inicio), width: `max(3px, ${pct(largo)})` }}
                  />
                ))}
                {hoyIndice >= 0 && (
                  <span
                    className="absolute inset-y-[-2px] w-px bg-texto"
                    style={{ left: pct(hoyIndice) }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
