import { useState } from 'react';
import { PARAMETROS_ENTEROS, errorParametro } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { useCambiarParametro } from './hooks.js';

// Un tiempo o límite de eco_configuracion: número con su unidad, rango y botón Guardar al cambiar.
export function CampoTiempo({ parametro, puedeEditar }) {
  const info = PARAMETROS_ENTEROS[parametro.clave];
  const cambiar = useCambiarParametro();
  const [texto, setTexto] = useState(null);
  const valorActual = parametro.valor ?? info.porDefecto;
  const valor = texto ?? (valorActual === null ? '' : String(valorActual));
  const numero = valor.trim() === '' ? NaN : Number(valor);
  const error = texto === null ? null : errorParametro(parametro.clave, numero);
  const cambio = texto !== null && numero !== valorActual;

  return (
    <div className="space-y-1">
      <label className="block text-sm" htmlFor={parametro.clave}>
        {info.titulo}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={parametro.clave}
          type="number"
          step="1"
          min={info.minimo}
          max={info.maximo}
          className={`${claseControl} max-w-24`}
          value={valor}
          disabled={!puedeEditar}
          onChange={(e) => setTexto(e.target.value)}
        />
        <span className="text-sm text-tenue">
          {info.unidad}{' '}
          <span className="text-xs text-apagado">
            ({info.minimo}–{info.maximo})
          </span>
        </span>
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
      {error && <p className="text-xs text-peligro">{error}</p>}
      {!error && info.ayuda && <p className="text-xs text-apagado">{info.ayuda}</p>}
      <MensajeError error={cambiar.error} />
    </div>
  );
}
