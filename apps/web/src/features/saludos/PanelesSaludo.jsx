import { useState } from 'react';
import {
  MODULOS_SALUDO,
  MODULOS_SALUDO_HOY,
  NOMBRES_MODULO_SALUDO,
  ahoraEnGuatemala,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { claseControl, claseFiltro } from '../../components/Campo.jsx';
import { GloboWhatsapp } from '../../components/GloboWhatsapp.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { useGuardarTextoMenu, useSaludoVigente, useSimulacion, useTextoMenu } from './hooks.js';

const SIN_SALUDO = 'Sin saludo: el bot usará el saludo por defecto';

function SaludoDeHoy({ modulo, textoMenu }) {
  const { data } = useSaludoVigente(modulo);
  return (
    <div className="space-y-2 rounded-lg border border-borde bg-panel p-4">
      <h3 className="text-sm font-medium">{NOMBRES_MODULO_SALUDO[modulo]}</h3>
      {data && (
        <GloboWhatsapp>
          {data.saludo ?? <span className="text-[#667781]">{SIN_SALUDO}</span>}
          {modulo === 'MENU' && textoMenu && `\n\n${textoMenu}`}
        </GloboWhatsapp>
      )}
    </div>
  );
}

// Tarjetas «Hoy el bot saluda así».
export function SaludosDeHoy() {
  const { data: menu } = useTextoMenu();
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Hoy el bot saluda así</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {MODULOS_SALUDO_HOY.map((m) => (
          <SaludoDeHoy key={m} modulo={m} textoMenu={menu?.texto} />
        ))}
      </div>
    </div>
  );
}

export function Simulador() {
  const ahora = ahoraEnGuatemala();
  const [campos, setCampos] = useState({ modulo: 'MENU', fecha: ahora.fecha, hora: '09:00' });
  const [consulta, setConsulta] = useState(null);
  const { data, error, isFetching } = useSimulacion(consulta);
  const cambiar = (campo) => (e) => setCampos({ ...campos, [campo]: e.target.value });

  return (
    <div className="space-y-3 rounded-lg border border-borde bg-panel p-4">
      <h3 className="font-medium">Simulador</h3>
      <div className="flex flex-wrap items-center gap-2">
        <select value={campos.modulo} onChange={cambiar('modulo')} className={claseFiltro}>
          {MODULOS_SALUDO.map((m) => (
            <option key={m} value={m}>
              {NOMBRES_MODULO_SALUDO[m]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={campos.fecha}
          onChange={cambiar('fecha')}
          className={claseFiltro}
        />
        <input type="time" value={campos.hora} onChange={cambiar('hora')} className={claseFiltro} />
        <Boton
          variante="secundario"
          cargando={isFetching}
          onClick={() => setConsulta({ ...campos })}
        >
          Simular
        </Boton>
      </div>
      <MensajeError error={error} />
      {data && (
        <div className="space-y-2">
          {data.candidatos.length === 0 && <GloboWhatsapp>{SIN_SALUDO}</GloboWhatsapp>}
          {data.candidatos.length > 1 && (
            <p className="text-sm text-alerta">
              Empate: el bot elegirá al azar entre {data.candidatos.length} saludos.
            </p>
          )}
          {data.candidatos.map((c) => (
            <div key={c.id}>
              <p className="mb-1 text-xs text-tenue">
                {c.nombre} · {NOMBRES_MODULO_SALUDO[c.modulo]} · prioridad {c.prioridad}
              </p>
              <GloboWhatsapp>{c.saludo}</GloboWhatsapp>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Texto que sigue al saludo en el menú inicial (eco_configuracion.menu_bienvenida_texto).
export function TextoMenu({ puedeEditar }) {
  const { data, error } = useTextoMenu();
  const guardar = useGuardarTextoMenu();
  const [texto, setTexto] = useState(null);
  if (error) return <MensajeError error={error} />;
  if (!data) return null;
  const valor = texto ?? data.texto;

  return (
    <div className="space-y-2 rounded-lg border border-borde bg-panel p-4">
      <h3 className="font-medium">Texto del menú inicial</h3>
      <textarea
        rows={4}
        className={claseControl}
        value={valor}
        disabled={!puedeEditar}
        onChange={(e) => setTexto(e.target.value)}
      />
      <MensajeError error={guardar.error} />
      {puedeEditar && (
        <div className="flex justify-end gap-2">
          {texto !== null && texto !== data.texto && (
            <Boton variante="secundario" onClick={() => setTexto(null)}>
              Descartar
            </Boton>
          )}
          <Boton
            disabled={texto === null || texto === data.texto}
            cargando={guardar.isPending}
            onClick={() =>
              guardar.mutate(
                { texto: valor, version: data.version },
                { onSuccess: () => setTexto(null) },
              )
            }
          >
            Guardar texto
          </Boton>
        </div>
      )}
    </div>
  );
}
