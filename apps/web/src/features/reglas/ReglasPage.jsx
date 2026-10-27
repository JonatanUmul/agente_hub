import { useMemo, useState } from 'react';
import { DESTINOS, ESTADOS_VIGENCIA, MODULOS } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { EnlaceHistorial } from '../../components/EnlaceHistorial.jsx';
import { claseFiltro } from '../../components/Campo.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { EstadoVigencia } from '../../components/EstadoVigencia.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { usePermiso } from '../auth/hooks.js';
import { ReglaForm } from './ReglaForm.jsx';
import { useCambiarActivoRegla, useCrearRegla, useEditarRegla, useReglas } from './hooks.js';

const FILTROS_INICIALES = { texto: '', modulo: '', destino: '', categoria: '', estado: '' };

// El filtro "módulo" muestra lo que el bot recibe en ese módulo: sus reglas + las GLOBAL.
function filtrar(reglas, f) {
  const texto = f.texto.trim().toLowerCase();
  return reglas.filter(
    (r) =>
      (!texto || [r.codigo, r.titulo, r.regla].some((v) => v.toLowerCase().includes(texto))) &&
      (!f.modulo || r.modulo === f.modulo || (r.modulo === 'GLOBAL' && f.incluirGlobales)) &&
      (!f.destino || r.destino === f.destino) &&
      (!f.categoria || r.categoria === f.categoria) &&
      (!f.estado || r.estadoVigencia === f.estado),
  );
}

export function ReglasPage() {
  const { data: reglas, isPending, error } = useReglas();
  const puedeEditar = usePermiso('reglas:editar');
  const crear = useCrearRegla();
  const editar = useEditarRegla();
  const cambiarActivo = useCambiarActivoRegla();
  const [filtros, setFiltros] = useState({ ...FILTROS_INICIALES, incluirGlobales: true });
  const [accion, setAccion] = useState(null); // { tipo: 'crear' | 'editar' | 'activo', regla? }

  const categorias = useMemo(
    () => [...new Set((reglas ?? []).map((r) => r.categoria))].sort(),
    [reglas],
  );
  const visibles = useMemo(() => filtrar(reglas ?? [], filtros), [reglas, filtros]);

  if (isPending) return <p className="text-slate-500">Cargando reglas…</p>;
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
    { titulo: 'Prio.', className: 'text-right', celda: (r) => r.prioridad },
    {
      titulo: 'Regla',
      celda: (r) => (
        <div className="max-w-xl">
          <div className="font-medium">{r.titulo}</div>
          <div className="text-xs text-slate-500">
            {r.codigo} · {r.categoria}
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-slate-700">{r.regla}</div>
        </div>
      ),
    },
    { titulo: 'Módulo', celda: (r) => r.modulo },
    { titulo: 'Destino', celda: (r) => r.destino },
    { titulo: 'Estado', celda: (r) => <EstadoVigencia estado={r.estadoVigencia} /> },
    {
      titulo: 'Activa',
      celda: (r) => (
        <Toggle
          activo={r.activo}
          etiqueta={`Activa: ${r.titulo}`}
          deshabilitado={!puedeEditar}
          alCambiar={() => setAccion({ tipo: 'activo', regla: r })}
        />
      ),
    },
    {
      titulo: '',
      className: 'text-right whitespace-nowrap',
      celda: (r) => (
        <div className="flex justify-end gap-3">
          <EnlaceHistorial tabla="eco_reglas_bot" registroId={r.id} />
          {puedeEditar && (
            <Boton variante="enlace" onClick={() => setAccion({ tipo: 'editar', regla: r })}>
              Editar
            </Boton>
          )}
        </div>
      ),
    },
  ];

  const regla = accion?.regla;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Reglas del bot</h2>
        {puedeEditar && <Boton onClick={() => setAccion({ tipo: 'crear' })}>Nueva regla</Boton>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Buscar código, título o texto"
          {...filtro('texto')}
          className={`${claseFiltro} w-64`}
        />
        <select {...filtro('modulo')}>
          <option value="">Todos los módulos</option>
          {MODULOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        {filtros.modulo && filtros.modulo !== 'GLOBAL' && (
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={filtros.incluirGlobales}
              onChange={(e) => setFiltros({ ...filtros, incluirGlobales: e.target.checked })}
            />
            incluir GLOBAL (lo que recibe el bot)
          </label>
        )}
        <select {...filtro('destino')}>
          <option value="">Todos los destinos</option>
          {DESTINOS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select {...filtro('categoria')}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select {...filtro('estado')}>
          <option value="">Todos los estados</option>
          {ESTADOS_VIGENCIA.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-500">
        {visibles.length} de {reglas.length} reglas
      </p>
      <Tabla columnas={columnas} filas={visibles} vacio="Ninguna regla coincide con los filtros" />

      <Modal
        abierto={accion?.tipo === 'crear' || accion?.tipo === 'editar'}
        titulo={accion?.tipo === 'crear' ? 'Nueva regla' : `Editar ${regla?.codigo}`}
        alCerrar={cerrar}
      >
        {(accion?.tipo === 'crear' || accion?.tipo === 'editar') && (
          <ReglaForm
            regla={accion.tipo === 'editar' ? regla : null}
            categorias={categorias}
            mutacion={accion.tipo === 'crear' ? crear : editar}
            alTerminar={cerrar}
            alCancelar={cerrar}
          />
        )}
      </Modal>

      <ConfirmarModal
        abierto={accion?.tipo === 'activo'}
        titulo={regla?.activo ? 'Desactivar regla' : 'Activar regla'}
        mensaje={
          regla?.activo
            ? `El bot dejará de seguir "${regla.titulo}" (${regla.modulo}) desde el siguiente mensaje.`
            : `El bot empezará a seguir "${regla?.titulo}" (${regla?.modulo}) mientras esté dentro de su vigencia.`
        }
        textoConfirmar={regla?.activo ? 'Desactivar' : 'Activar'}
        peligro={regla?.activo}
        cargando={cambiarActivo.isPending}
        error={cambiarActivo.error}
        alConfirmar={() =>
          cambiarActivo.mutate(
            { id: regla.id, activo: !regla.activo, version: regla.version },
            { onSuccess: cerrar },
          )
        }
        alCancelar={cerrar}
      />
    </section>
  );
}
