import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
  pautaId: p.pauta?.id ?? null,
  orden: p.orden,
  activo: p.activo,
});

// Cambios que alteran lo que paga el cliente o si el bot ofrece el producto: piden confirmación.
function cambiosSensibles(antes, despues) {
  const cambios = [];
  if (antes.precioBase !== despues.precioBase)
    cambios.push(['Precio base', monto(antes.precioBase), monto(despues.precioBase)]);
  if (antes.descuentoPct !== despues.descuentoPct)
    cambios.push(['Descuento', porcentaje(antes.descuentoPct), porcentaje(despues.descuentoPct)]);
  if ((antes.pauta?.id ?? null) !== despues.pautaId)
    cambios.push(['Pauta', antes.pauta?.nombre ?? 'Ninguna', despues.pautaNombre]);
  if (antes.activo && !despues.activo)
    cambios.push(['Activo', 'Sí', 'No (el bot dejará de ofrecerlo)']);
  return cambios;
}

// Un <select> que se dibuja antes de tener sus opciones muestra la primera ("Ninguna") aunque el
// valor sea otro. Por eso el formulario espera a tener las pautas antes de dibujarse.
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
  const [precioBase, descuentoPct, pautaId, activo] = useWatch({
    control,
    name: ['precioBase', 'descuentoPct', 'pautaId', 'activo'],
  });
  const pauta = pautas.find((p) => p.id === pautaId) ?? null;
  const descuentoPrevio = Number.isFinite(descuentoPct)
    ? descuentoVigente({ descuentoPct, pauta })
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
      pautaNombre: pautas.find((p) => p.id === datos.pautaId)?.nombre ?? 'Ninguna',
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
      <Campo etiqueta="Pauta asociada" error={errors.pautaId}>
        <select className={claseControl} {...register('pautaId', { setValueAs: vacioANull })}>
          <option value="">Ninguna</option>
          {pautas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({porcentaje(p.descuentoPct)}){!p.vigente && ' — no vigente'}
            </option>
          ))}
        </select>
      </Campo>
      {pauta && !pauta.vigente && (
        <p className="rounded-md bg-alerta/10 px-3 py-2 text-sm text-alerta">
          Esta pauta no está vigente: mientras siga asociada, el producto{' '}
          <strong>no tendrá ningún descuento</strong>, tampoco el propio.
        </p>
      )}
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
