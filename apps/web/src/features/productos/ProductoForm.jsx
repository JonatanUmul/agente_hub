import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ESTADOS_PRODUCTO,
  TIPOS_CON_VISION,
  calcularPrecioFinal,
  contradiccionesFicha,
  descuentoVigente,
  errorPrecioRequerido,
  esquemaDatosProductoNuevo,
  esquemaEditarProducto,
  tienePrecioSiLoNecesita,
} from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { Pestanas } from '../../components/Pestanas.jsx';
import { SelectorPautas } from '../../components/SelectorPautas.jsx';
import { monto, porcentaje } from '../../lib/formato.js';
import { usePautasResumen } from '../pautas/hooks.js';
import { obtenerImpactoCodigo } from './api.js';
import { PestanaFicha, PestanaMedidas, PestanaWeb, vacioANull } from './CamposFicha.jsx';
import { CamposIdentidad } from './CamposIdentidad.jsx';
import { FichaDelBot } from './FichaDelBot.jsx';
import { ImpactoCodigo } from './ImpactoCodigo.jsx';
import { LoQueVeElBot } from './LoQueVeElBot.jsx';
import { PestanaImagen } from './PestanaImagen.jsx';
import { valoresParaCrear, valoresParaEditar } from './valoresFormulario.js';

// En el formulario las listas se escriben separadas por comas; se validan con las reglas de shared.
const textoALista = z.string().transform((texto) => texto.split(','));
// Las características son filas [{ texto }] (useFieldArray necesita objetos).
const filasALista = z
  .array(z.object({ texto: z.string() }))
  .transform((filas) => filas.map((f) => f.texto));
const listas = (esquema) => ({
  colores: textoALista.pipe(esquema.shape.colores),
  palabrasClave: textoALista.pipe(esquema.shape.palabrasClave),
  caracteristicas: filasALista.pipe(esquema.shape.caracteristicas),
});
const esquemaEditar = esquemaEditarProducto
  .omit({ version: true, confirmarCambioCodigo: true })
  .extend(listas(esquemaEditarProducto));
const esquemaCrear = esquemaDatosProductoNuevo
  .extend(listas(esquemaDatosProductoNuevo))
  .refine(tienePrecioSiLoNecesita, errorPrecioRequerido);

// Pestañas del formulario y los campos de cada una (para marcar la que tiene errores).
const PESTANAS = [
  {
    id: 'general',
    titulo: 'General',
    campos: [
      'codigo',
      'nombre',
      'tipo',
      'familia',
      'capacidadLitros',
      'variante',
      'nombreCorto',
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
  {
    id: 'imagen',
    titulo: 'Identificación por imagen',
    campos: ['pistasVisuales', 'fotosReferencia'],
  },
];

// La pestaña de imagen es para equipos y repuestos; en otro tipo solo aparece si ya tiene datos (para vaciarla).
const conPestanaImagen = (enVivo) =>
  TIPOS_CON_VISION.includes(enVivo.tipo) ||
  Boolean(enVivo.pistasVisuales) ||
  (enVivo.fotosReferencia ?? []).length > 0;

const aLista = (texto) =>
  (texto ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

// El producto tal como quedaría con lo que se está escribiendo (para avisos y vistas previas).
const productoEnVivo = (producto, valores) => ({
  ...valores,
  nombre: producto?.nombre ?? valores.nombre,
  tipo: producto?.tipo ?? valores.tipo,
  capacidadLitros: producto?.capacidadLitros ?? valores.capacidadLitros,
  colores: aLista(valores.colores),
  caracteristicas: (valores.caracteristicas ?? []).map((f) => f.texto),
});

const nombres = (lista) => (lista.length ? lista.map((pa) => pa.nombre).join(', ') : 'Ninguna');

// Cambios que alteran lo que paga el cliente o si el bot ofrece el producto: piden confirmación.
function cambiosSensibles(antes, despues) {
  const cambios = [];
  if (antes.codigo !== despues.codigo) cambios.push(['ItemCode', antes.codigo, despues.codigo]);
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
// `producto`: el que se edita; sin él, se crea uno nuevo. `valoresIniciales` (opcional): p. ej. un duplicado.
export function ProductoForm(props) {
  const { data: pautas, isPending, error } = usePautasResumen();
  if (isPending) return <Cargando />;
  if (error) return <MensajeError error={error} />;
  return <FormularioProducto {...props} pautas={pautas} />;
}

function FormularioProducto({
  producto,
  valoresIniciales,
  interruptores,
  pautas,
  mutacion,
  alTerminar,
  alCancelar,
}) {
  const creando = !producto;
  const [porConfirmar, setPorConfirmar] = useState(null); // { datos, cambios, impacto? }
  const [entendido, setEntendido] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [pestana, setPestana] = useState('general');
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(creando ? esquemaCrear : esquemaEditar),
    defaultValues: valoresIniciales ?? (creando ? valoresParaCrear() : valoresParaEditar(producto)),
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
    mutacion.mutate(creando ? datos : { id: producto.id, version: producto.version, ...datos }, {
      onSuccess: alTerminar,
    });

  // Al cambiar el ItemCode se consulta antes con quién choca y a qué afecta.
  const revisarCodigo = async (codigo) => {
    setRevisando(true);
    try {
      const impacto = await obtenerImpactoCodigo({ id: producto.id, codigo });
      if (impacto.conflicto) {
        const c = impacto.conflicto;
        setError('codigo', {
          message: `Ya lo usa «${c.nombre}» (ItemCode ${c.codigo}${c.activo ? '' : ', inactivo'})`,
        });
        setPestana('general');
        return null;
      }
      return impacto;
    } finally {
      setRevisando(false);
    }
  };

  const enviar = async (datos) => {
    if (creando) return guardar(datos);
    const cambios = cambiosSensibles(producto, {
      ...datos,
      nombresPautas: nombres(pautas.filter((pa) => datos.pautaIds.includes(pa.id))),
    });
    const cambiaCodigo = datos.codigo !== producto.codigo;
    const impacto = cambiaCodigo ? await revisarCodigo(datos.codigo) : null;
    if (cambiaCodigo && !impacto) return;
    setEntendido(false);
    if (cambios.length > 0) setPorConfirmar({ datos, cambios, impacto });
    else guardar(datos);
  };

  // Al guardar con errores, se abre la primera pestaña que los tiene.
  const conError = (p) => p.campos.some((campo) => errors[campo]);
  const alFallar = (errores) => {
    const primera = PESTANAS.find((p) => p.campos.some((campo) => errores[campo]));
    if (primera) setPestana(primera.id);
  };

  if (porConfirmar) {
    const { datos, cambios, impacto } = porConfirmar;
    const faltaEntender = impacto?.menciones.length > 0 && !entendido;
    return (
      <div className="space-y-4 text-sm">
        <p>Estos cambios aplican en el siguiente mensaje de cada cliente:</p>
        <table className="w-full">
          <tbody>
            {cambios.map(([campo, antes, despues]) => (
              <tr key={campo} className="border-b border-borde">
                <td className="py-1 font-medium">{campo}</td>
                <td className="py-1 text-tenue line-through">{antes}</td>
                <td className="py-1">{despues}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {impacto && (
          <ImpactoCodigo
            antes={producto.codigo}
            despues={datos.codigo}
            impacto={impacto}
            entendido={entendido}
            alEntender={setEntendido}
          />
        )}
        <MensajeError error={mutacion.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setPorConfirmar(null)}>
            Volver
          </Boton>
          <Boton
            disabled={faltaEntender}
            cargando={mutacion.isPending}
            onClick={() => guardar({ ...datos, confirmarCambioCodigo: Boolean(impacto) })}
          >
            Confirmar y guardar
          </Boton>
        </div>
      </div>
    );
  }

  const pestanas = PESTANAS.filter((p) => p.id !== 'imagen' || conPestanaImagen(enVivo));
  return (
    <form onSubmit={handleSubmit(enviar, alFallar)} className="space-y-4" noValidate>
      <Pestanas
        pestanas={pestanas.map((p) => ({ ...p, conError: conError(p) }))}
        activa={pestana}
        alCambiar={setPestana}
      />

      {/* Las pestañas ocultas siguen montadas: sus campos se validan y se guardan igual. */}
      <div hidden={pestana !== 'general'} className="space-y-4">
        <CamposIdentidad producto={producto} register={register} errors={errors} />
        <div className="grid grid-cols-2 gap-4">
          <Campo
            etiqueta="Precio base (Q)"
            error={errors.precioBase}
            ayuda={creando ? 'Requerido, salvo descontinuado' : 'Vacío = sin precio'}
          >
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
          mostrarDescuento
        />
        <Campo etiqueta="Colores" error={errors.colores} ayuda="Separados por comas">
          <input className={claseControl} {...register('colores')} />
        </Campo>
        <Campo etiqueta="Palabras clave" error={errors.palabrasClave} ayuda="Separadas por comas">
          <input className={claseControl} {...register('palabrasClave')} />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('activo')} /> Activo
        </label>
      </div>

      <div hidden={pestana !== 'ficha'}>
        <PestanaFicha
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
      {conPestanaImagen(enVivo) && (
        <div hidden={pestana !== 'imagen'}>
          <PestanaImagen
            productoId={producto?.id ?? null}
            register={register}
            control={control}
            errors={errors}
            enVivo={enVivo}
          />
        </div>
      )}

      <div className="space-y-2 rounded-md bg-panel-2 p-3 text-sm">
        <p className="font-medium">Así lo ve el bot</p>
        <p>
          Precio final:{' '}
          <strong>{monto(calcularPrecioFinal(productoPrevio.precioBase, descuentoPrevio))}</strong>{' '}
          <span className="text-tenue">(descuento vigente {porcentaje(descuentoPrevio)})</span>
        </p>
        <p>
          Precio que da el bot:{' '}
          <LoQueVeElBot producto={productoPrevio} interruptores={interruptores} />
        </p>
        <div className="border-t border-borde pt-2">
          <p className="mb-1 text-xs text-tenue">Ficha</p>
          <FichaDelBot producto={enVivo} />
          {contradicciones.length > 0 && (
            <p className="mt-2 text-xs text-alerta">
              ⚠ {contradicciones.length} posible(s) contradicción(es) en las características.
            </p>
          )}
        </div>
      </div>

      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={revisando || (creando && mutacion.isPending)}>
          {creando ? 'Crear producto' : 'Guardar'}
        </Boton>
      </div>
    </form>
  );
}
