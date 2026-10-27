import { useMemo, useState } from 'react';
import { MODULOS } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { EnlaceHistorial } from '../../components/EnlaceHistorial.jsx';
import { claseFiltro } from '../../components/Campo.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { usePermiso } from '../auth/hooks.js';
import { PreguntaForm } from './PreguntaForm.jsx';
import {
  useCambiarActivoPregunta,
  useCrearPregunta,
  useEditarPregunta,
  usePreguntas,
} from './hooks.js';

const FILTROS_INICIALES = { texto: '', modulo: '', tema: '', activo: 'todos' };

function filtrar(preguntas, f) {
  const texto = f.texto.trim().toLowerCase();
  return preguntas.filter(
    (p) =>
      (!texto ||
        [p.pregunta, p.respuesta, ...p.palabrasClave].some((v) =>
          v.toLowerCase().includes(texto),
        )) &&
      (!f.modulo || p.modulos.includes(f.modulo)) &&
      (!f.tema || p.tema === f.tema) &&
      (f.activo === 'todos' || p.activo === (f.activo === 'activas')),
  );
}

export function PreguntasPage() {
  const { data: preguntas, isPending, error } = usePreguntas();
  const puedeEditar = usePermiso('preguntas:editar');
  const crear = useCrearPregunta();
  const editar = useEditarPregunta();
  const cambiarActivo = useCambiarActivoPregunta();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [accion, setAccion] = useState(null); // { tipo: 'crear' | 'editar' | 'activo', pregunta? }

  const temas = useMemo(
    () => [...new Set((preguntas ?? []).map((p) => p.tema).filter(Boolean))].sort(),
    [preguntas],
  );
  const visibles = useMemo(() => filtrar(preguntas ?? [], filtros), [preguntas, filtros]);

  if (isPending) return <p className="text-slate-500">Cargando preguntas…</p>;
  if (error) return <MensajeError error={error} />;

  const cerrar = () => {
    setAccion(null);
    [crear, editar, cambiarActivo].forEach((m) => m.reset());
  };
  const filtro = (campo) => ({
    value: filtros[campo],
    onChange: (e) => setFiltros({ ...filtros, [campo]: e.target.value }),
    className: claseFiltro,
  });

  const columnas = [
    { titulo: 'N.º', className: 'text-right', celda: (p) => p.numero },
    {
      titulo: 'Pregunta',
      celda: (p) => (
        <div className="max-w-xl">
          <div className="font-medium">{p.pregunta}</div>
          <div className="mt-1 line-clamp-2 text-xs text-slate-700">{p.respuesta}</div>
        </div>
      ),
    },
    { titulo: 'Tema', celda: (p) => p.tema ?? '—' },
    { titulo: 'Módulos', celda: (p) => <span className="text-xs">{p.modulos.join(', ')}</span> },
    { titulo: 'Orden', className: 'text-right', celda: (p) => p.orden },
    {
      titulo: 'Activa',
      celda: (p) => (
        <Toggle
          activo={p.activo}
          etiqueta={`Activa: pregunta ${p.numero}`}
          deshabilitado={!puedeEditar}
          alCambiar={() => setAccion({ tipo: 'activo', pregunta: p })}
        />
      ),
    },
    {
      titulo: '',
      className: 'text-right whitespace-nowrap',
      celda: (p) => (
        <div className="flex justify-end gap-3">
          <EnlaceHistorial tabla="eco_preguntas_frecuentes" registroId={p.numero} />
          {puedeEditar && (
            <Boton variante="enlace" onClick={() => setAccion({ tipo: 'editar', pregunta: p })}>
              Editar
            </Boton>
          )}
        </div>
      ),
    },
  ];

  const pregunta = accion?.pregunta;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Preguntas frecuentes</h2>
        {puedeEditar && <Boton onClick={() => setAccion({ tipo: 'crear' })}>Nueva pregunta</Boton>}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Buscar en pregunta, respuesta o palabras clave"
          {...filtro('texto')}
          className={`${claseFiltro} w-72`}
        />
        <select {...filtro('modulo')}>
          <option value="">Todos los módulos</option>
          {MODULOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select {...filtro('tema')}>
          <option value="">Todos los temas</option>
          {temas.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select {...filtro('activo')}>
          <option value="todos">Activas e inactivas</option>
          <option value="activas">Solo activas</option>
          <option value="inactivas">Solo inactivas</option>
        </select>
      </div>

      <p className="text-xs text-slate-500">
        {visibles.length} de {preguntas.length} preguntas
      </p>
      <Tabla
        columnas={columnas}
        filas={visibles}
        vacio="Ninguna pregunta coincide con los filtros"
      />

      <Modal
        abierto={accion?.tipo === 'crear' || accion?.tipo === 'editar'}
        titulo={accion?.tipo === 'crear' ? 'Nueva pregunta' : `Editar pregunta ${pregunta?.numero}`}
        alCerrar={cerrar}
      >
        {(accion?.tipo === 'crear' || accion?.tipo === 'editar') && (
          <PreguntaForm
            pregunta={accion.tipo === 'editar' ? pregunta : null}
            mutacion={accion.tipo === 'crear' ? crear : editar}
            alTerminar={cerrar}
            alCancelar={cerrar}
          />
        )}
      </Modal>

      <ConfirmarModal
        abierto={accion?.tipo === 'activo'}
        titulo={pregunta?.activo ? 'Desactivar pregunta' : 'Activar pregunta'}
        mensaje={
          pregunta?.activo
            ? `El bot dejará de usar la pregunta ${pregunta.numero} desde el siguiente mensaje.`
            : `El bot volverá a usar la pregunta ${pregunta?.numero}.`
        }
        textoConfirmar={pregunta?.activo ? 'Desactivar' : 'Activar'}
        peligro={pregunta?.activo}
        cargando={cambiarActivo.isPending}
        error={cambiarActivo.error}
        alConfirmar={() =>
          cambiarActivo.mutate(
            { id: pregunta.id, activo: !pregunta.activo, version: pregunta.version },
            { onSuccess: cerrar },
          )
        }
        alCancelar={cerrar}
      />
    </section>
  );
}
