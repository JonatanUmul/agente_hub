import { useState } from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ESTADOS_PRODUCTO,
  calcularPrecioFinal,
  descuentoVigente,
  esquemaEditarProducto,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { monto, porcentaje } from '../../lib/formato.js';
import { usePautasResumen } from '../pautas/hooks.js';
import { LoQueVeElBot } from './LoQueVeElBot.jsx';

// En el formulario las listas se escriben separadas por comas; se validan con las reglas de shared.
const textoALista = z.string().transform((texto) => texto.split(','));
const esquemaFormulario = esquemaEditarProducto.omit({ version: true }).extend({
  colores: textoALista.pipe(esquemaEditarProducto.shape.colores),
  palabrasClave: textoALista.pipe(esquemaEditarProducto.shape.palabrasClave),
});

const vacioANull = (valor) => (valor === '' || valor === null ? null : Number(valor));

const valoresIniciales = (p) => ({
  precioBase: p.precioBase,
  descuentoPct: p.descuentoPct,
  estado: p.estado,
  colores: p.colores.join(', '),
  palabrasClave: p.palabrasClave.join(', '),
  pautaIds: p.pautas.map((pa) => pa.id).sort((a, b) => a - b),
  orden: p.orden,
  activo: p.activo,
});

const nombres = (lista) => (lista.length ? lista.map((pa) => pa.nombre).join(', ') : 'Ninguna');

// Cambios que alteran lo que paga el cliente o si el bot ofrece el producto: piden confirmación.
function cambiosSensibles(antes, despues) {
  const cambios = [];
  if (antes.precioBase !== despues.precioBase)
    cambios.push(['Precio base', monto(antes.precioBase), monto(despues.precioBase)]);
  if (antes.descuentoPct !== despues.descuentoPct)
    cambios.push(['Descuento', porcentaje(antes.descuentoPct), porcentaje(despues.descuentoPct)]);
  const idsAntes = antes.pautas.map((pa) => pa.id).sort((a, b) => a - b);
  if (JSON.stringify(idsAntes) !== JSON.stringify(despues.pautaIds))
    cambios.push(['Pautas', nombres(antes.pautas), despues.nombresPautas]);
  if (antes.activo && !despues.activo)
    cambios.push(['Activo', 'Sí', 'No (el bot dejará de ofrecerlo)']);
  return cambios;
}

// El formulario espera a tener la lista de pautas antes de dibujarse (para mostrar las marcadas).
export function ProductoForm(props) {
  const { data: pautas, isPending, error } = usePautasResumen();
  if (isPending) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  return <FormularioProducto {...props} pautas={pautas} />;
}

function FormularioProducto({ producto, interruptores, pautas, mutacion, alTerminar, alCancelar }) {
  const [porConfirmar, setPorConfirmar] = useState(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: valoresIniciales(producto),
  });

  // Vista previa en vivo: con los valores que se están escribiendo.
  const [precioBase, descuentoPct, pautaIds, activo] = useWatch({
    control,
    name: ['precioBase', 'descuentoPct', 'pautaIds', 'activo'],
  });
  const seleccionadas = pautas.filter((pa) => pautaIds.includes(pa.id));
  const descuentoPrevio = Number.isFinite(descuentoPct)
    ? descuentoVigente({ descuentoPct, pautas: seleccionadas })
    : null;
  const productoPrevio = {
    activo,
    precioBase: Number.isFinite(precioBase) ? precioBase : null,
    descuentoVigentePct: descuentoPrevio ?? 0,
  };

  const guardar = (datos) =>
    mutacion.mutate(
      { id: producto.id, version: producto.version, ...datos },
      { onSuccess: alTerminar },
    );

  const enviar = (datos) => {
    const cambios = cambiosSensibles(producto, {
      ...datos,
      nombresPautas: nombres(pautas.filter((pa) => datos.pautaIds.includes(pa.id))),
    });
    if (cambios.length > 0) setPorConfirmar({ datos, cambios });
    else guardar(datos);
  };

  if (porConfirmar) {
    return (
      <div className="space-y-4 text-sm">
        <p>Estos cambios aplican en el siguiente mensaje de cada cliente:</p>
        <table className="w-full">
          <tbody>
            {porConfirmar.cambios.map(([campo, antes, despues]) => (
              <tr key={campo} className="border-b border-borde">
                <td className="py-1 font-medium">{campo}</td>
                <td className="py-1 text-tenue line-through">{antes}</td>
                <td className="py-1">{despues}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <MensajeError error={mutacion.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setPorConfirmar(null)}>
            Volver
          </Boton>
          <Boton cargando={mutacion.isPending} onClick={() => guardar(porConfirmar.datos)}>
            Confirmar y guardar
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
      <p className="text-sm text-tenue">
        ItemCode <span className="font-mono">{producto.codigo}</span> · {producto.tipo} ·{' '}
        {producto.familia}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Precio base (Q)" error={errors.precioBase} ayuda="Vacío = sin precio">
          <input
            type="number"
            step="0.01"
            min="0"
            className={claseControl}
            {...register('precioBase', { setValueAs: vacioANull })}
          />
        </Campo>
        <Campo etiqueta="Descuento propio (%)" error={errors.descuentoPct}>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className={claseControl}
            {...register('descuentoPct', { valueAsNumber: true })}
          />
        </Campo>
        <Campo etiqueta="Estado" error={errors.estado}>
          <select className={claseControl} {...register('estado')}>
            {ESTADOS_PRODUCTO.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Orden" error={errors.orden} ayuda="Menor = aparece primero">
          <input
            type="number"
            step="1"
            className={claseControl}
            {...register('orden', { valueAsNumber: true })}
          />
        </Campo>
      </div>
      <SelectorPautas control={control} pautas={pautas} error={errors.pautaIds} />
      <Campo etiqueta="Colores" error={errors.colores} ayuda="Separados por comas">
        <input className={claseControl} {...register('colores')} />
      </Campo>
      <Campo etiqueta="Palabras clave" error={errors.palabrasClave} ayuda="Separadas por comas">
        <input className={claseControl} {...register('palabrasClave')} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('activo')} /> Activo (el bot lo conoce y lo ofrece)
      </label>

      <div className="rounded-md bg-panel-2 p-3 text-sm">
        <p>
          Precio final:{' '}
          <strong>{monto(calcularPrecioFinal(productoPrevio.precioBase, descuentoPrevio))}</strong>{' '}
          <span className="text-tenue">(descuento vigente {porcentaje(descuentoPrevio)})</span>
        </p>
        <p>
          Lo que dirá el bot ahora:{' '}
          <LoQueVeElBot producto={productoPrevio} interruptores={interruptores} />
        </p>
      </div>

      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit">Guardar</Boton>
      </div>
    </form>
  );
}

// Lista de casillas para elegir varias pautas. Controlada (useController) para que el valor sea
// siempre una lista de ids, también cuando existe una sola pauta.
function SelectorPautas({ control, pautas, error }) {
  const { field } = useController({ control, name: 'pautaIds' });
  const alternar = (id) =>
    field.onChange(
      field.value.includes(id)
        ? field.value.filter((x) => x !== id)
        : [...field.value, id].sort((a, b) => a - b),
    );

  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-tenue">Pautas</legend>
      {pautas.length === 0 ? (
        <p className="text-sm text-apagado">No hay pautas creadas.</p>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-borde-fuerte bg-fondo p-2">
          {pautas.map((pa) => (
            <label
              key={pa.id}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-panel-2"
            >
              <input
                type="checkbox"
                checked={field.value.includes(pa.id)}
                onChange={() => alternar(pa.id)}
              />
              <span className="flex-1">{pa.nombre}</span>
              <span className="text-xs text-tenue">{porcentaje(pa.descuentoPct)}</span>
              {!pa.vigente && <span className="text-xs text-apagado">no vigente</span>}
            </label>
          ))}
        </div>
      )}
      <span className="mt-1 block text-xs text-apagado">
        Se aplica el mayor descuento entre el propio y el de las pautas vigentes.
      </span>
      {error && <span className="mt-1 block text-xs text-peligro">{error.message}</span>}
    </fieldset>
  );
}
