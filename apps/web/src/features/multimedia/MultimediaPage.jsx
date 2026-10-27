import { useMemo, useState } from 'react';
import { TIPOS_MULTIMEDIA, comoLoVeElBot } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { EnlaceHistorial } from '../../components/EnlaceHistorial.jsx';
import { claseFiltro } from '../../components/Campo.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { usePermiso } from '../auth/hooks.js';
import { ArchivoForm } from './ArchivoForm.jsx';
import {
  useArchivos,
  useCambiarActivoArchivo,
  useCrearArchivo,
  useEditarArchivo,
} from './hooks.js';

const FILTROS_INICIALES = { texto: '', tipo: '', activo: 'todos', soloInvisibles: false };

// Pocos registros: se filtra en el navegador (igual que productos).
function filtrar(archivos, f) {
  const texto = f.texto.trim().toLowerCase();
  return archivos.filter((a) => {
    const campos = [
      a.descripcion,
      a.hubspotFileId,
      a.color,
      a.tema,
      a.producto?.nombre,
      a.producto?.codigo,
      ...a.pautas.map((pa) => pa.nombre),
    ];
    return (
      (!texto || campos.some((v) => v?.toLowerCase().includes(texto))) &&
      (!f.tipo || a.tipo === f.tipo) &&
      (f.activo === 'todos' || a.activo === (f.activo === 'activos')) &&
      (!f.soloInvisibles || !visibilidad(a).visible)
    );
  });
}
const visibilidad = (a) =>
  comoLoVeElBot({ tipo: a.tipo, activo: a.activo, pautaIds: a.pautas.map((pa) => pa.id) });

export function MultimediaPage() {
  const { data: archivos, isPending, error } = useArchivos();
  const puedeEditar = usePermiso('multimedia:editar');
  const crear = useCrearArchivo();
  const editar = useEditarArchivo();
  const cambiarActivo = useCambiarActivoArchivo();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [accion, setAccion] = useState(null); // { tipo: 'crear' | 'editar' | 'activo', archivo? }
  const visibles = useMemo(() => filtrar(archivos ?? [], filtros), [archivos, filtros]);

  if (isPending) return <p className="text-tenue">Cargando multimedia…</p>;
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
  const promocionesSinPauta = (archivos ?? []).filter(
    (a) => a.activo && !visibilidad(a).visible,
  ).length;

  const columnas = [
    {
      titulo: 'Archivo',
      celda: (a) => (
        <>
          <div className="font-medium">{a.descripcion}</div>
          <div className="text-xs text-tenue">
            {a.tipo} · ID {a.hubspotFileId}
          </div>
        </>
      ),
    },
    {
      titulo: 'Producto / color',
      celda: (a) => (
        <div className="text-xs">
          <div>{a.producto?.nombre ?? '—'}</div>
          {a.producto && <div className="font-mono text-tenue">{a.producto.codigo}</div>}
          {a.color && <div className="text-tenue">{a.color}</div>}
        </div>
      ),
    },
    { titulo: 'Tema', celda: (a) => a.tema ?? '—' },
    {
      titulo: 'Pautas',
      celda: (a) =>
        a.pautas.length ? (
          <div className="text-xs">
            {a.pautas.map((pa) => (
              <div key={pa.id}>{pa.nombre}</div>
            ))}
          </div>
        ) : (
          <span className="text-apagado">—</span>
        ),
    },
    { titulo: 'Orden', className: 'text-right', celda: (a) => a.orden },
    {
      titulo: 'El bot',
      celda: (a) => {
        const v = visibilidad(a);
        return (
          <span className={`text-xs ${v.visible ? 'text-tenue' : 'text-alerta'}`}>{v.detalle}</span>
        );
      },
    },
    {
      titulo: 'Activo',
      celda: (a) => (
        <Toggle
          activo={a.activo}
          etiqueta={`Activo: ${a.descripcion}`}
          deshabilitado={!puedeEditar}
          alCambiar={() => setAccion({ tipo: 'activo', archivo: a })}
        />
      ),
    },
    {
      titulo: '',
      className: 'text-right whitespace-nowrap',
      celda: (a) => (
        <div className="flex justify-end gap-3">
          <EnlaceHistorial tabla="eco_multimedia" registroId={a.id} />
          {puedeEditar && (
            <Boton variante="enlace" onClick={() => setAccion({ tipo: 'editar', archivo: a })}>
              Editar
            </Boton>
          )}
        </div>
      ),
    },
  ];

  const archivo = accion?.archivo;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Multimedia</h2>
        {puedeEditar && <Boton onClick={() => setAccion({ tipo: 'crear' })}>Agregar archivo</Boton>}
      </div>
      {promocionesSinPauta > 0 && (
        <p className="rounded-md bg-alerta/10 px-3 py-2 text-sm text-alerta">
          {promocionesSinPauta} archivo(s) activo(s) no llegan al bot (promociones sin pauta).{' '}
          <Boton
            variante="enlace"
            onClick={() => setFiltros({ ...FILTROS_INICIALES, soloInvisibles: true })}
          >
            Ver cuáles
          </Boton>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Buscar descripción, ID, producto, ItemCode, pauta…"
          {...filtro('texto')}
          className={`${claseFiltro} w-72`}
        />
        <select {...filtro('tipo')}>
          <option value="">Todos los tipos</option>
          {TIPOS_MULTIMEDIA.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select {...filtro('activo')}>
          <option value="todos">Activos e inactivos</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
        {JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIALES) && (
          <Boton variante="enlace" onClick={() => setFiltros(FILTROS_INICIALES)}>
            Limpiar filtros
          </Boton>
        )}
      </div>

      <p className="text-xs text-tenue">
        {visibles.length} de {archivos.length} archivos
      </p>
      <Tabla columnas={columnas} filas={visibles} vacio="Ningún archivo coincide con los filtros" />

      <Modal
        abierto={accion?.tipo === 'crear' || accion?.tipo === 'editar'}
        titulo={accion?.tipo === 'crear' ? 'Agregar archivo' : 'Editar archivo'}
        alCerrar={cerrar}
      >
        {(accion?.tipo === 'crear' || accion?.tipo === 'editar') && (
          <ArchivoForm
            archivo={accion.tipo === 'editar' ? archivo : null}
            mutacion={accion.tipo === 'crear' ? crear : editar}
            alTerminar={cerrar}
            alCancelar={cerrar}
          />
        )}
      </Modal>

      <ConfirmarModal
        abierto={accion?.tipo === 'activo'}
        titulo={archivo?.activo ? 'Desactivar archivo' : 'Activar archivo'}
        mensaje={
          archivo?.activo
            ? `El bot dejará de enviar "${archivo.descripcion}" desde el siguiente mensaje.`
            : `El bot podrá volver a enviar "${archivo?.descripcion}".`
        }
        textoConfirmar={archivo?.activo ? 'Desactivar' : 'Activar'}
        peligro={archivo?.activo}
        cargando={cambiarActivo.isPending}
        error={cambiarActivo.error}
        alConfirmar={() =>
          cambiarActivo.mutate(
            { id: archivo.id, activo: !archivo.activo, version: archivo.version },
            { onSuccess: cerrar },
          )
        }
        alCancelar={cerrar}
      />
    </section>
  );
}
