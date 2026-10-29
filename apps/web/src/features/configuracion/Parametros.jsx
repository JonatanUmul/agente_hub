import { useState } from 'react';
import { PARAMETROS_ENTEROS, errorParametro } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { useCambiarParametro, useParametros } from './hooks.js';

function Parametro({ parametro, puedeEditar }) {
  const info = PARAMETROS_ENTEROS[parametro.clave];
  const cambiar = useCambiarParametro();
  const [texto, setTexto] = useState(null);
  const valorActual = parametro.valor ?? info.porDefecto;
  const valor = texto ?? String(valorActual);
  const numero = valor.trim() === '' ? NaN : Number(valor);
  const error = texto === null ? null : errorParametro(parametro.clave, numero);
  const cambio = texto !== null && numero !== valorActual;

  return (
    <div className="rounded-lg border border-borde bg-panel p-4">
      <Campo
        etiqueta={`${info.titulo} (${info.minimo}–${info.maximo})`}
        ayuda={info.ayuda}
        error={error ? { message: error } : undefined}
      >
        <div className="flex gap-2">
          <input
            type="number"
            step="1"
            min={info.minimo}
            max={info.maximo}
            className={`${claseControl} max-w-28`}
            value={valor}
            disabled={!puedeEditar}
            onChange={(e) => setTexto(e.target.value)}
          />
          {puedeEditar && cambio && (
            <Boton
              disabled={Boolean(error)}
              cargando={cambiar.isPending}
              onClick={() =>
                cambiar.mutate(
                  { clave: parametro.clave, valor: numero, version: parametro.version },
                  { onSuccess: () => setTexto(null) },
                )
              }
            >
              Guardar
            </Boton>
          )}
        </div>
      </Campo>
      <MensajeError error={cambiar.error} />
    </div>
  );
}

// Parámetros numéricos del bot (eco_configuracion, tipo entero).
export function Parametros({ puedeEditar }) {
  const { data, error } = useParametros();
  if (error) return <MensajeError error={error} />;
  if (!data) return null;
  const faltan = Object.keys(PARAMETROS_ENTEROS).filter((c) => !data.some((p) => p.clave === c));
  return (
    <div className="space-y-3">
      {data.map((p) => (
        <Parametro key={p.clave} parametro={p} puedeEditar={puedeEditar} />
      ))}
      {faltan.map((c) => (
        <p key={c} className="text-sm text-alerta">
          No existe la clave {c} en eco_configuracion.
        </p>
      ))}
    </div>
  );
}
