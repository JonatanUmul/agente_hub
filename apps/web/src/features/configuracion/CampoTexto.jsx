import { useState } from 'react';
import { PARAMETROS_TEXTO, errorParametroTexto } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { useCambiarTexto } from './hooks.js';

// Un parámetro de texto de eco_configuracion (vision_modelo), con botón Guardar al cambiar.
export function CampoTexto({ parametro, puedeEditar }) {
  const info = PARAMETROS_TEXTO[parametro.clave];
  const cambiar = useCambiarTexto();
  const [texto, setTexto] = useState(null);
  const valor = texto ?? parametro.valor ?? '';
  const error = texto === null ? null : errorParametroTexto(parametro.clave, valor);
  const cambio = texto !== null && valor.trim() !== parametro.valor;

  return (
    <div className="space-y-1">
      <label className="block text-sm" htmlFor={parametro.clave}>
        {info.titulo}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={parametro.clave}
          className={`${claseControl} max-w-xs font-mono`}
          placeholder={info.porDefecto}
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
                { clave: parametro.clave, valor: valor.trim(), version: parametro.version },
                { onSuccess: () => setTexto(null) },
              )
            }
          >
            Guardar
          </Boton>
        )}
      </div>
      {error && <p className="text-xs text-peligro">{error}</p>}
      {!error && <p className="text-xs text-apagado">{info.ayuda}</p>}
      <MensajeError error={cambiar.error} />
    </div>
  );
}
