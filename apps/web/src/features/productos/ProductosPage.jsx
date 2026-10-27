import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ESTADOS_PRODUCTO, TIPOS_PRODUCTO } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { EnlaceHistorial } from '../../components/EnlaceHistorial.jsx';
import { BotonCopiar } from '../../components/BotonCopiar.jsx';
import { claseFiltro } from '../../components/Campo.jsx';
import { ConfirmarModal } from '../../components/ConfirmarModal.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { monto, porcentaje } from '../../lib/formato.js';
import { usePermiso } from '../auth/hooks.js';
import { useEstadoInterruptores } from '../configuracion/hooks.js';
import { useCambiarActivoProducto, useEditarProducto, useProductos } from './hooks.js';
import { LoQueVeElBot } from './LoQueVeElBot.jsx';
import { ProductoForm } from './ProductoForm.jsx';

const FILTROS_INICIALES = { texto: '', tipo: '', familia: '', estado: '', activo: 'todos' };

// El catálogo es pequeño (decenas de productos): se pide completo y se filtra en el navegador,
// así los filtros responden al instante sin ir a la API.
function filtrar(productos, f) {
  const texto = f.texto.trim().toLowerCase();
  return productos.filter(
    (p) =>
      (!texto ||
        [p.codigo, p.nombre, ...p.palabrasClave].some((v) => v.toLowerCase().includes(texto))) &&
      (!f.tipo || p.tipo === f.tipo) &&
      (!f.familia || p.familia === f.familia) &&
      (!f.estado || p.estado === f.estado) &&
      (f.activo === 'todos' || p.activo === (f.activo === 'activos')),
  );
}

export function ProductosPage() {
  const { data: productos, isPending, error } = useProductos();
  const { estado: interruptores } = useEstadoInterruptores();
  const puedeEditar = usePermiso('productos:editar');
  const editar = useEditarProducto();
  const cambiarActivo = useCambiarActivoProducto();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [accion, setAccion] = useState(null); // { tipo: 'editar' | 'activo', producto }

  const familias = useMemo(
    () => [...new Set((productos ?? []).map((p) => p.familia))].sort(),
    [productos],
  );
  const visibles = useMemo(() => filtrar(productos ?? [], filtros), [productos, filtros]);

  if (isPending) return <p className="text-tenue">Cargando productos…</p>;
  if (error) return <MensajeError error={error} />;

  const cerrar = () => {
    setAccion(null);
    editar.reset();
    cambiarActivo.reset();
  };
  const filtro = (campo) => ({
    value: filtros[campo],
    onChange: (e) => setFiltros({ ...filtros, [campo]: e.target.value }),
    className: claseFiltro,
  });

  const columnas = [
    {
      titulo: 'Producto',
      celda: (p) => (
        <>
          <div className="font-medium">{p.nombre}</div>
          <div className="flex items-center gap-1 text-xs text-tenue">
            <span className="whitespace-nowrap">
              ItemCode <span className="font-mono whitespace-nowrap text-texto">{p.codigo}</span>
            </span>
            <BotonCopiar texto={p.codigo} />
          </div>
          <div className="text-xs text-tenue">
            {p.tipo} · {p.familia}
          </div>
        </>
      ),
    },
    { titulo: 'Estado', celda: (p) => p.estado },
    { titulo: 'Precio base', className: 'text-right', celda: (p) => monto(p.precioBase) },
    {
      titulo: 'Descuento',
      className: 'text-right',
      celda: (p) => <Descuento producto={p} />,
    },
    { titulo: 'Precio final', className: 'text-right', celda: (p) => monto(p.precioFinal) },
    {
      titulo: 'Lo que ve el bot',
      celda: (p) => <LoQueVeElBot producto={p} interruptores={interruptores} />,
    },
    {
      titulo: 'Activo',
      celda: (p) => (
        <Toggle
          activo={p.activo}
          etiqueta={`Activo: ${p.nombre}`}
          deshabilitado={!puedeEditar}
          alCambiar={() => setAccion({ tipo: 'activo', producto: p })}
        />
      ),
    },
    {
      titulo: '',
      className: 'text-right whitespace-nowrap',
      celda: (p) => (
        <div className="flex justify-end gap-3">
          <EnlaceHistorial tabla="eco_productos" registroId={p.id} />
          {puedeEditar && (
            <Boton variante="enlace" onClick={() => setAccion({ tipo: 'editar', producto: p })}>
              Editar
            </Boton>
          )}
        </div>
      ),
    },
  ];

  const producto = accion?.producto;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Productos</h2>
        <p className="text-sm text-tenue">
          Precios {interruptores.precios_habilitados ? 'encendidos' : 'apagados'} · promociones{' '}
          {interruptores.promociones_habilitadas ? 'encendidas' : 'apagadas'} ·{' '}
          <Link to="/interruptores" className="text-acento underline">
            cambiar
          </Link>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Buscar ItemCode, nombre o palabra clave"
          {...filtro('texto')}
          className={`${claseFiltro} w-64`}
        />
        <select {...filtro('tipo')}>
          <option value="">Todos los tipos</option>
          {TIPOS_PRODUCTO.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select {...filtro('familia')}>
          <option value="">Todas las familias</option>
          {familias.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select {...filtro('estado')}>
          <option value="">Todos los estados</option>
          {ESTADOS_PRODUCTO.map((e) => (
            <option key={e}>{e}</option>
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
        {visibles.length} de {productos.length} productos
      </p>
      <Tabla
        columnas={columnas}
        filas={visibles}
        vacio="Ningún producto coincide con los filtros"
      />

      <Modal
        abierto={accion?.tipo === 'editar'}
        titulo={`Editar ${producto?.nombre}`}
        alCerrar={cerrar}
      >
        {accion?.tipo === 'editar' && (
          <ProductoForm
            producto={producto}
            interruptores={interruptores}
            mutacion={editar}
            alTerminar={cerrar}
            alCancelar={cerrar}
          />
        )}
      </Modal>

      <ConfirmarModal
        abierto={accion?.tipo === 'activo'}
        titulo={producto?.activo ? 'Desactivar producto' : 'Activar producto'}
        mensaje={
          producto?.activo
            ? `El bot dejará de conocer y ofrecer "${producto.nombre}" desde el siguiente mensaje.`
            : `El bot volverá a ofrecer "${producto?.nombre}" desde el siguiente mensaje.`
        }
        textoConfirmar={producto?.activo ? 'Desactivar' : 'Activar'}
        peligro={producto?.activo}
        cargando={cambiarActivo.isPending}
        error={cambiarActivo.error}
        alConfirmar={() =>
          cambiarActivo.mutate(
            { id: producto.id, activo: !producto.activo, version: producto.version },
            { onSuccess: cerrar },
          )
        }
        alCancelar={cerrar}
      />
    </section>
  );
}

// Muestra el descuento vigente y advierte cuando la pauta asociada anula el propio.
function Descuento({ producto: p }) {
  if (!p.activo) return porcentaje(p.descuentoPct);
  const anulado = p.pauta && !p.pauta.vigente && p.descuentoPct > 0;
  return (
    <div>
      <div>{porcentaje(p.descuentoVigentePct)}</div>
      {p.pauta && (
        <div className={`text-xs ${p.pauta.vigente ? 'text-tenue' : 'text-alerta'}`}>
          {p.pauta.nombre}
          {!p.pauta.vigente && ' (no vigente)'}
        </div>
      )}
      {anulado && <div className="text-xs text-alerta">anula su {p.descuentoPct}% propio</div>}
    </div>
  );
}
