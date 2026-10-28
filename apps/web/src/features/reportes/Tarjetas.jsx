import { entero, porcentajeDe } from './formato.js';

// Indicadores que se comparan contra el periodo anterior. `extra`: un porcentaje que acompaña al número.
const TARJETAS = [
  { clave: 'conversaciones', titulo: 'Conversaciones del bot' },
  { clave: 'soloBot', titulo: 'Atendidas solo por el bot' },
  { clave: 'transferidas', titulo: 'Transferidas a asesor', extra: 'porcentajeTransferidas' },
  { clave: 'mensajesBandeja', titulo: 'Mensajes en la bandeja' },
  { clave: 'cambiosModulo', titulo: 'Cambiaron de módulo' },
  { clave: 'avisosFueraHorario', titulo: 'Avisos fuera de horario' },
  { clave: 'avisosInactividad', titulo: 'Avisos de inactividad' },
  { clave: 'ofertasRecuperacion', titulo: 'Ofertas de recuperación' },
  { clave: 'cierresInactividad', titulo: 'Cerradas por inactividad' },
  { clave: 'reactivadas', titulo: 'Reactivadas tras el aviso', extra: 'porcentajeReactivacion' },
];

// La variación se muestra sin color de "bueno" o "malo": que suban las transferencias, por ejemplo,
// no es bueno ni malo por sí solo.
function Variacion({ indicador }) {
  if (indicador.variacion === null) return <span className="text-apagado">—</span>;
  const flecha = indicador.variacion > 0 ? '▲' : indicador.variacion < 0 ? '▼' : '=';
  return (
    <span className="text-tenue">
      {flecha} {Math.abs(indicador.variacion)}% ({entero(indicador.anterior)})
    </span>
  );
}

export function Tarjetas({ tarjetas, tiempoAsignacion }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {TARJETAS.map(({ clave, titulo, extra }) => {
        const indicador = tarjetas[clave];
        return (
          <div key={clave} className="rounded-lg border border-borde bg-panel p-4">
            <p className="text-xs text-tenue">{titulo}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {entero(indicador.valor)}
              {extra && tarjetas[extra].valor !== null && (
                <span className="ml-2 text-sm font-normal text-tenue">
                  {porcentajeDe(tarjetas[extra].valor)}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs">
              <Variacion indicador={indicador} />
            </p>
          </div>
        );
      })}
      <TiempoAsignacion tiempo={tiempoAsignacion} />
    </div>
  );
}

function TiempoAsignacion({ tiempo }) {
  return (
    <div className="rounded-lg border border-borde bg-panel p-4">
      <p className="text-xs text-tenue">Espera hasta pasar a asesor</p>
      {tiempo.casos === 0 ? (
        <p className="mt-1 text-sm text-apagado">—</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {tiempo.medianaMin}{' '}
            <span className="text-sm font-normal text-tenue">min (mediana)</span>
          </p>
          <p className="mt-1 text-xs text-tenue">
            p90 {tiempo.p90Min} min · {entero(tiempo.casos)} caso(s)
          </p>
        </>
      )}
    </div>
  );
}
