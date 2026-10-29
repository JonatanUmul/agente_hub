import { useState } from 'react';
import { MENSAJES_PROTEGIDOS, nombreComodin } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { EnlaceHistorial } from '../../components/EnlaceHistorial.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import {
  useCambiarActivoMensaje,
  useCrearMensaje,
  useEditarMensaje,
  useEliminarMensaje,
  useReordenarMensajes,
} from './hooks.js';
import { VersionForm } from './VersionForm.jsx';

const SIN_TEXTO = 'Es la última versión activa: el bot usará su texto por defecto.';

// ¿El cambio deja sin versiones activas un mensaje protegido? (la API lo vuelve a verificar)
const quedaSinActivas = (tipo, id, activoNuevo) =>
  MENSAJES_PROTEGIDOS.includes(tipo.clave) &&
  !tipo.versiones.some((v) => (v.id === id ? activoNuevo : v.activo));

export function TarjetaMensaje({ tipo, ejemplo, puedeEditar }) {
  const crear = useCrearMensaje();
  const editar = useEditarMensaje();
  const cambiarActivo = useCambiarActivoMensaje();
  const eliminar = useEliminarMensaje();
  const reordenar = useReordenarMensajes();
  const [formulario, setFormulario] = useState(null); // { version: v | null }
  const [confirmacion, setConfirmacion] = useState(null); // { titulo, mensaje, peligro, ejecutar }

  const activas = tipo.versiones.filter((v) => v.activo).length;
  const cerrar = () => {
    setConfirmacion(null);
    [cambiarActivo, eliminar].forEach((m) => m.reset());
  };
  const alternar = (v, activo) => {
    const ejecutar = (confirmar) =>
      cambiarActivo.mutate(
        { id: v.id, activo, version: v.version, confirmar },
        { onSuccess: cerrar },
      );
    if (quedaSinActivas(tipo, v.id, activo)) {
      setConfirmacion({
        titulo: 'Desactivar la última versión',
        mensaje: SIN_TEXTO,
        peligro: true,
        ejecutar,
      });
    } else ejecutar(false);
  };
  const borrar = (v) =>
    setConfirmacion({
      titulo: 'Eliminar versión',
      mensaje: quedaSinActivas(tipo, v.id, false)
        ? `¿Eliminar esta versión? No se puede deshacer. ${SIN_TEXTO}`
        : '¿Eliminar esta versión? No se puede deshacer.',
      peligro: true,
      ejecutar: (confirmar) =>
        eliminar.mutate({ id: v.id, version: v.version, confirmar }, { onSuccess: cerrar }),
    });
  const mover = (i, paso) => {
    const ids = tipo.versiones.map((v) => v.id);
    [ids[i], ids[i + paso]] = [ids[i + paso], ids[i]];
    reordenar.mutate(ids.map((id, n) => ({ id, orden: (n + 1) * 10 })));
  };
  const guardar = (datos) => {
    const v = formulario.version;
    const terminar = { onSuccess: () => setFormulario(null) };
    if (!v) return crear.mutate({ clave: tipo.clave, ...datos }, terminar);
    const ejecutar = (confirmar) =>
      editar.mutate(
        { id: v.id, ...datos, version: v.version, confirmar },
        {
          onSuccess: () => {
            setFormulario(null);
            setConfirmacion(null);
          },
        },
      );
    if (quedaSinActivas(tipo, v.id, datos.activo)) {
      setConfirmacion({
        titulo: 'Desactivar la última versión',
        mensaje: SIN_TEXTO,
        peligro: true,
        ejecutar,
      });
    } else ejecutar(false);
  };

  return (
    <article
      id={tipo.clave}
      className="scroll-mt-20 space-y-3 rounded-lg border border-borde bg-panel p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-medium">{tipo.titulo}</h4>
          {tipo.descripcion && <p className="text-xs text-tenue">{tipo.descripcion}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {tipo.comodines.map(nombreComodin).map((c) => (
              <span
                key={c}
                className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[11px] text-tenue"
              >
                {`{${c}}`}
              </span>
            ))}
          </div>
        </div>
        {puedeEditar && !formulario && (
          <Boton variante="secundario" onClick={() => setFormulario({ version: null })}>
            Agregar versión
          </Boton>
        )}
      </div>

      {activas === 0 && (
        <p className="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm">
          Sin versiones activas: el bot usará su texto por defecto.
        </p>
      )}
      <MensajeError error={reordenar.error} />

      {tipo.versiones.length > 0 && (
        <ul className="divide-y divide-borde rounded-md border border-borde">
          {tipo.versiones.map((v, i) =>
            formulario?.version?.id === v.id ? (
              <li key={v.id} className="p-2">
                <VersionForm
                  tipo={tipo}
                  version={v}
                  ejemplo={ejemplo}
                  mutacion={editar}
                  alGuardar={guardar}
                  alCancelar={() => setFormulario(null)}
                />
              </li>
            ) : (
              <li
                key={v.id}
                className={`flex items-start gap-3 p-2 ${v.activo ? '' : 'opacity-60'}`}
              >
                <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap">{v.texto}</p>
                <Toggle
                  activo={v.activo}
                  etiqueta={`Activa: ${v.texto}`}
                  deshabilitado={!puedeEditar}
                  alCambiar={(activo) => alternar(v, activo)}
                />
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  {puedeEditar && (
                    <>
                      <button
                        type="button"
                        className="text-tenue hover:text-texto disabled:opacity-30"
                        aria-label="Subir"
                        disabled={i === 0}
                        onClick={() => mover(i, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-tenue hover:text-texto disabled:opacity-30"
                        aria-label="Bajar"
                        disabled={i === tipo.versiones.length - 1}
                        onClick={() => mover(i, 1)}
                      >
                        ↓
                      </button>
                      <Boton variante="enlace" onClick={() => setFormulario({ version: v })}>
                        Editar
                      </Boton>
                      <Boton variante="enlace" className="!text-peligro" onClick={() => borrar(v)}>
                        Eliminar
                      </Boton>
                    </>
                  )}
                  <EnlaceHistorial tabla="eco_mensajes" registroId={v.id} />
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {formulario && !formulario.version && (
        <VersionForm
          tipo={tipo}
          ejemplo={ejemplo}
          mutacion={crear}
          alGuardar={guardar}
          alCancelar={() => setFormulario(null)}
        />
      )}

      <ConfirmarModal
        abierto={Boolean(confirmacion)}
        titulo={confirmacion?.titulo}
        mensaje={confirmacion?.mensaje}
        textoConfirmar="Confirmar"
        peligro={confirmacion?.peligro}
        cargando={cambiarActivo.isPending || eliminar.isPending || editar.isPending}
        error={cambiarActivo.error ?? eliminar.error ?? editar.error}
        alConfirmar={() => confirmacion.ejecutar(true)}
        alCancelar={cerrar}
      />
    </article>
  );
}
