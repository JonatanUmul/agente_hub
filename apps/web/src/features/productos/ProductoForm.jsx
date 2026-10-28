import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAMPOS_FICHA,
  ESTADOS_PRODUCTO,
  calcularPrecioFinal,
  contradiccionesFicha,
  descuentoVigente,
  esquemaEditarProducto,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Pestanas } from '../../components/Pestanas.jsx';
import { SelectorPautas } from '../../components/SelectorPautas.jsx';
import { monto, porcentaje } from '../../lib/formato.js';
import { usePautasResumen } from '../pautas/hooks.js';
import { PestanaFicha, PestanaMedidas, PestanaWeb, vacioANull } from './CamposFicha.jsx';
import { FichaDelBot } from './FichaDelBot.jsx';
import { LoQueVeElBot } from './LoQueVeElBot.jsx';

// En el formulario las listas se escriben separadas por comas; se validan con las reglas de shared.
const textoALista = z.string().transform((texto) => texto.split(','));
// Las características son filas [{ texto }] (useFieldArray necesita objetos).
const filasALista = z
  .array(z.object({ texto: z.string() }))
  .transform((filas) => filas.map((f) => f.texto));
const esquemaFormulario = esquemaEditarProducto.omit({ version: true }).extend({
  colores: textoALista.pipe(esquemaEditarProducto.shape.colores),
  palabrasClave: textoALista.pipe(esquemaEditarProducto.shape.palabrasClave),
  caracteristicas: filasALista.pipe(esquemaEditarProducto.shape.caracteristicas),
});

const NUMEROS_FICHA = ['capacidadPurificadorLitros', 'anchoCm', 'altoCm', 'largoCm', 'pesoLb'];
const fichaInicial = (p) =>
  Object.fromEntries(
    CAMPOS_FICHA.map((campo) => {
      if (campo === 'caracteristicas')
        return [campo, p.caracteristicas.map((texto) => ({ texto }))];
      if (NUMEROS_FICHA.includes(campo)) return [campo, p[campo]];
      return [campo, p[campo] ?? ''];
    }),
  );

// Pestañas del formulario y los campos de cada una (para marcar la que tiene errores).
const PESTANAS = [
  {
    id: 'general',
    titulo: 'General',
    campos: [
      'precioBase',
      'descuentoPct',
      'estado',
      'orden',
      'pautaIds',
      'colores',
      'palabrasClave',
    ],
  },
  {
    id: 'ficha',
    titulo: 'Ficha',
    campos: [
      'descripcionCorta',
      'descripcion',
      'caracteristicas',
      'material',
      'capacidadTexto',
      'capacidadPurificadorLitros',
      'tasaFiltrado',
      'compatibleCon',
    ],
  },
  { id: 'medidas', titulo: 'Medidas', campos: ['anchoCm', 'altoCm', 'largoCm', 'pesoLb'] },
  { id: 'web', titulo: 'Web', campos: ['urlWeb'] },
];

const aLista = (texto) =>
  (texto ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

// El producto tal como quedaría con lo que se está escribiendo (para avisos y vistas previas).
const productoEnVivo = (producto, valores) => ({
  ...valores,
  nombre: producto.nombre,
  tipo: producto.tipo,
  capacidadLitros: producto.capacidadLitros,
  colores: aLista(valores.colores),
  caracteristicas: (valores.caracteristicas ?? []).map((f) => f.texto),
});

const valoresIniciales = (p) => ({
  precioBase: p.precioBase,
  descuentoPct: p.descuentoPct,
  estado: p.estado,
  colores: p.colores.join(', '),
  palabrasClave: p.palabrasClave.join(', '),
  pautaIds: p.pautas.map((pa) => pa.id).sort((a, b) => a - b),
  orden: p.orden,
  activo: p.activo,
  ...fichaInicial(p),
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
  const [pestana, setPestana] = useState('general');
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
  const valores = useWatch({ control });
  const { precioBase, descuentoPct, pautaIds, activo } = valores;
  const enVivo = productoEnVivo(producto, valores);
  const contradicciones = contradiccionesFicha(enVivo);
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

  // Al guardar con errores, se abre la primera pestaña que los tiene.
  const conError = (p) => p.campos.some((campo) => errors[campo]);
  const alFallar = (errores) => {
    const primera = PESTANAS.find((p) => p.campos.some((campo) => errores[campo]));
    if (primera) setPestana(primera.id);
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
    <form onSubmit={handleSubmit(enviar, alFallar)} className="space-y-4" noValidate>
      <p className="text-sm text-tenue">
        ItemCode <span className="font-mono">{producto.codigo}</span> · {producto.tipo} ·{' '}
        {producto.familia}
      </p>
      <Pestanas
        pestanas={PESTANAS.map((p) => ({ ...p, conError: conError(p) }))}
        activa={pestana}
        alCambiar={setPestana}
      />

      {/* Las pestañas ocultas siguen montadas: sus campos se validan y se guardan igual. */}
      <div hidden={pestana !== 'general'} className="space-y-4">
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
        <SelectorPautas
          control={control}
          pautas={pautas}
          error={errors.pautaIds}
          ayuda="Se aplica el mayor descuento entre el propio y el de las pautas vigentes."
          mostrarDescuento
        />
        <Campo etiqueta="Colores" error={errors.colores} ayuda="Separados por comas">
          <input className={claseControl} {...register('colores')} />
        </Campo>
        <Campo etiqueta="Palabras clave" error={errors.palabrasClave} ayuda="Separadas por comas">
          <input className={claseControl} {...register('palabrasClave')} />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('activo')} /> Activo (el bot lo conoce y lo ofrece)
        </label>
      </div>

      <div hidden={pestana !== 'ficha'}>
        <PestanaFicha
          producto={producto}
          register={register}
          control={control}
          errors={errors}
          contradicciones={contradicciones}
          enVivo={enVivo}
        />
      </div>
      <div hidden={pestana !== 'medidas'}>
        <PestanaMedidas register={register} errors={errors} enVivo={enVivo} />
      </div>
      <div hidden={pestana !== 'web'}>
        <PestanaWeb register={register} errors={errors} enVivo={enVivo} />
      </div>

      <div className="space-y-2 rounded-md bg-panel-2 p-3 text-sm">
        <p className="font-medium">Así lo ve el bot</p>
        <p>
          Precio final:{' '}
          <strong>{monto(calcularPrecioFinal(productoPrevio.precioBase, descuentoPrevio))}</strong>{' '}
          <span className="text-tenue">(descuento vigente {porcentaje(descuentoPrevio)})</span>
        </p>
        <p>
          Lo que dirá el bot ahora:{' '}
          <LoQueVeElBot producto={productoPrevio} interruptores={interruptores} />
        </p>
        <div className="border-t border-borde pt-2">
          <p className="mb-1 text-xs text-tenue">
            Ficha que recibe cuando el cliente pregunta por el detalle:
          </p>
          <FichaDelBot producto={enVivo} />
          {contradicciones.length > 0 && (
            <p className="mt-2 text-xs text-alerta">
              ⚠ {contradicciones.length} característica(s) podrían contradecir los campos del
              producto (ver pestaña Ficha).
            </p>
          )}
        </div>
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
