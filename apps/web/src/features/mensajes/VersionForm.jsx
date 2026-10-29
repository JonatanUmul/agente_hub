import { useRef, useState } from 'react';
import {
  EMOJIS_MENSAJE,
  MAX_MENSAJE,
  errorTextoMensaje,
  nombreComodin,
  textoDeEjemplo,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseControl } from '../../components/Campo.jsx';
import { GloboWhatsapp } from '../../components/GloboWhatsapp.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';

// *negrita* de WhatsApp en la vista previa.
function ConNegrita({ texto }) {
  return texto
    .split(/(\*[^*\n]+\*)/g)
    .map((parte, i) =>
      /^\*[^*\n]+\*$/.test(parte) ? <strong key={i}>{parte.slice(1, -1)}</strong> : parte,
    );
}

// Formulario de una versión: texto con comodines y emojis insertados en el cursor, contador y vista previa.
export function VersionForm({ tipo, version, ejemplo, mutacion, alGuardar, alCancelar }) {
  const [texto, setTexto] = useState(version?.texto ?? '');
  const [activo, setActivo] = useState(version?.activo ?? true);
  const [tocado, setTocado] = useState(false);
  const entrada = useRef(null);
  const error = tocado ? errorTextoMensaje(texto, tipo) : null;
  const largo = [...texto.trim()].length;

  const insertar = (valor) => {
    const el = entrada.current;
    const inicio = el?.selectionStart ?? texto.length;
    const fin = el?.selectionEnd ?? texto.length;
    setTexto(`${texto.slice(0, inicio)}${valor}${texto.slice(fin)}`);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(inicio + valor.length, inicio + valor.length);
    });
  };
  const guardar = () => {
    setTocado(true);
    if (errorTextoMensaje(texto, tipo)) return;
    alGuardar({ texto: texto.trim(), activo });
  };

  return (
    <div className="space-y-3 rounded-md border border-borde p-3">
      <textarea
        ref={entrada}
        rows={3}
        aria-label="Texto"
        className={claseControl}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {tipo.comodines.map(nombreComodin).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => insertar(`{${c}}`)}
              className="rounded border border-borde-fuerte px-1.5 py-0.5 font-mono text-xs hover:bg-panel-2"
            >
              {`{${c}}`}
            </button>
          ))}
          {EMOJIS_MENSAJE.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertar(e)}
              className="rounded px-1 py-0.5 text-base hover:bg-panel-2"
              aria-label={`Insertar ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
        <span className={`text-xs ${largo > MAX_MENSAJE ? 'text-peligro' : 'text-apagado'}`}>
          {largo}/{MAX_MENSAJE}
        </span>
      </div>
      {error && <p className="text-xs text-peligro">{error}</p>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />{' '}
        Activa
      </label>
      {texto.trim() && (
        <GloboWhatsapp>
          <ConNegrita texto={textoDeEjemplo(texto.trim(), ejemplo)} />
        </GloboWhatsapp>
      )}
      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton cargando={mutacion.isPending} onClick={guardar}>
          {version ? 'Guardar' : 'Agregar'}
        </Boton>
      </div>
    </div>
  );
}
