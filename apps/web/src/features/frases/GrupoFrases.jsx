import { useState } from 'react';
import { NOMBRES_MODULO_FRASE, ordenarGrupo } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { EnlaceHistorial } from '../../components/EnlaceHistorial.jsx';
import { Toggle } from '../../components/Toggle.jsx';

// Grupo del bot = mismo módulo y situación: el orden solo cambia dentro de él.
const grupo = (f) => `${f.modulo}/${f.situacion}`;

// Lista de frases de una situación. Se reordena arrastrando (o con ↑ ↓ desde el teclado), siempre dentro
// del mismo módulo; `alReordenar` recibe [{ id, orden }] del grupo completo.
export function GrupoFrases({
  frases,
  puedeEditar,
  alReordenar,
  alCambiarActivo,
  alEditar,
  alEliminar,
}) {
  const [arrastrada, setArrastrada] = useState(null);

  // Mueve `id` a la posición de `destinoId` dentro de su grupo.
  const mover = (id, destinoId) => {
    const origen = frases.find((f) => f.id === id);
    const delGrupo = frases.filter((f) => grupo(f) === grupo(origen)).map((f) => f.id);
    const sinOrigen = delGrupo.filter((x) => x !== id);
    sinOrigen.splice(delGrupo.indexOf(destinoId), 0, id);
    if (JSON.stringify(sinOrigen) !== JSON.stringify(delGrupo))
      alReordenar(ordenarGrupo(sinOrigen));
  };
  const vecino = (f, paso) => {
    const delGrupo = frases.filter((x) => grupo(x) === grupo(f));
    return delGrupo[delGrupo.indexOf(f) + paso];
  };

  if (frases.length === 0) return <p className="px-1 text-sm text-apagado">Sin frases.</p>;
  return (
    <ul className="divide-y divide-borde rounded-lg border border-borde bg-panel">
      {frases.map((f) => {
        const puedeSoltar = arrastrada && arrastrada.id !== f.id && grupo(arrastrada) === grupo(f);
        const anterior = vecino(f, -1);
        const siguiente = vecino(f, 1);
        return (
          <li
            key={f.id}
            draggable={puedeEditar}
            onDragStart={() => setArrastrada(f)}
            onDragEnd={() => setArrastrada(null)}
            onDragOver={(e) => puedeSoltar && e.preventDefault()}
            onDrop={() => puedeSoltar && mover(arrastrada.id, f.id)}
            className={`flex flex-wrap items-center gap-3 px-3 py-2 ${puedeSoltar ? 'bg-panel-2' : ''} ${f.activo ? '' : 'opacity-60'}`}
          >
            {puedeEditar && (
              <span
                className="cursor-grab text-apagado select-none"
                aria-hidden="true"
                title="Arrastra para ordenar"
              >
                ⠿
              </span>
            )}
            <span className="min-w-0 flex-1 text-sm">{f.frase}</span>
            <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] text-tenue">
              {NOMBRES_MODULO_FRASE[f.modulo]}
            </span>
            <Toggle
              activo={f.activo}
              etiqueta={`Activa: ${f.frase}`}
              deshabilitado={!puedeEditar}
              alCambiar={(activo) => alCambiarActivo(f, activo)}
            />
            <div className="flex items-center gap-2 text-sm">
              {puedeEditar && (
                <>
                  <button
                    type="button"
                    className="text-tenue hover:text-texto disabled:opacity-30"
                    aria-label={`Subir: ${f.frase}`}
                    disabled={!anterior}
                    onClick={() => mover(f.id, anterior.id)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-tenue hover:text-texto disabled:opacity-30"
                    aria-label={`Bajar: ${f.frase}`}
                    disabled={!siguiente}
                    onClick={() => mover(f.id, siguiente.id)}
                  >
                    ↓
                  </button>
                  <Boton variante="enlace" onClick={() => alEditar(f)}>
                    Editar
                  </Boton>
                  <Boton variante="enlace" className="!text-peligro" onClick={() => alEliminar(f)}>
                    Eliminar
                  </Boton>
                </>
              )}
              <EnlaceHistorial tabla="eco_frases_cierre" registroId={f.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
