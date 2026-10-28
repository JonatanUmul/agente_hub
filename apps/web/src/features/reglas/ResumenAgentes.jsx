import { INFO_DESTINOS, LIMITE_CARACTERES_AGENTE, resumenPorAgente } from '@ecofiltro/shared';

const miles = (n) => n.toLocaleString('es-GT');

// Lo que recibe cada agente: por destino y módulo, reglas vigentes propias + las de TODOS y su largo total.
// Amarillo: más de 12 000 caracteres (más tokens y el modelo obedece peor). Rojo: sin reglas propias.
export function ResumenAgentes({ reglas, alElegir }) {
  const filas = resumenPorAgente(reglas);
  const destinos = [...new Set(filas.map((f) => f.destino))];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {destinos.map((destino) => {
        const suyas = filas.filter((f) => f.destino === destino);
        const sinPropias = suyas.every((f) => f.sinPropias);
        return (
          <button
            key={destino}
            type="button"
            onClick={() => alElegir(destino)}
            title="Ver las reglas que recibe este agente"
            className={`rounded-lg border bg-panel p-3 text-left transition-colors hover:bg-panel-2/60 ${
              sinPropias ? 'border-peligro/50' : 'border-borde'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs font-medium">{destino}</span>
              {sinPropias && (
                <span className="text-xs text-peligro">Sin reglas propias activas</span>
              )}
            </div>
            <p className="mb-2 truncate text-xs text-tenue">{INFO_DESTINOS[destino].agentes}</p>
            <table className="w-full text-xs">
              <tbody>
                {suyas.map((f) => (
                  <tr key={f.modulo} className={f.excedeLimite ? 'text-alerta' : ''}>
                    <td className="py-0.5 pr-2 text-tenue">{f.modulo}</td>
                    <td className="py-0.5 pr-2">
                      {f.propias} + {f.generales} reglas
                    </td>
                    <td className="py-0.5 text-right font-mono">
                      {miles(f.caracteres)}
                      {f.excedeLimite && ' ⚠'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {suyas.some((f) => f.excedeLimite) && (
              <p className="mt-1 text-[11px] text-alerta">
                {miles(LIMITE_CARACTERES_AGENTE)} caracteres
              </p>
            )}
            {/**   <p className="mt-1 text-[11px] text-alerta">
                Pasa de {miles(LIMITE_CARACTERES_AGENTE)} caracteres: más tokens y el modelo obedece
                peor.
              </p>
              */}
          </button>
        );
      })}
    </div>
  );
}
