import { EJEMPLOS_SITUACION } from '@ecofiltro/shared';

// Globo de mensaje al estilo de WhatsApp: un ejemplo de respuesta de la situación + línea en blanco + la frase,
// tal como la pega el bot al final de su mensaje.
export function VistaPreviaWhatsapp({ situacion, frase }) {
  return (
    <div className="rounded-md bg-panel-2 p-3">
      <div className="max-w-sm rounded-lg rounded-tl-none bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21] shadow-sm">
        <p>{EJEMPLOS_SITUACION[situacion] ?? EJEMPLOS_SITUACION.general}</p>
        <p className="mt-4">
          {frase || <span className="text-[#667781]">(escribe la frase)</span>}
        </p>
      </div>
    </div>
  );
}
