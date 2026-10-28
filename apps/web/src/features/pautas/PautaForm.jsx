import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { esquemaCrearPauta, esquemaEditarPauta } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { fecha, porcentaje } from '../../lib/formato.js';
import { isoALocal, localAIso } from '../../lib/fechas.js';

// El formulario trabaja con texto (palabras separadas por comas, fechas en hora local).
// Se convierte al formato de la API y se valida con el MISMO esquema de shared que usa la API.
const desdeFormulario = (d) => ({
  ...d,
  palabrasClave: d.palabrasClave.split(','),
  vigenteDesde: localAIso(d.vigenteDesde),
  vigenteHasta: localAIso(d.vigenteHasta),
});

function esquemaFormulario(pauta) {
  if (!pauta) return z.any().transform(desdeFormulario).pipe(esquemaCrearPauta);
  return z
    .any()
    .transform((d) => ({ ...desdeFormulario(d), version: pauta.version }))
    .pipe(esquemaEditarPauta);
}

const vacioANull = (valor) => (valor === '' || valor === null ? null : Number(valor));

const valoresIniciales = (p) => ({
  codigo: p?.codigo ?? '',
  nombre: p?.nombre ?? '',
  mensajeCliente: p?.mensajeCliente ?? '',
  descuentoPct: p?.descuentoPct ?? null,
  palabrasClave: p?.palabrasClave.join(', ') ?? '',
  vigenteDesde: isoALocal(p?.vigenteDesde),
  vigenteHasta: isoALocal(p?.vigenteHasta),
  activo: p?.activo ?? true,
});

// Qué cambios afectan lo que el bot dice hoy (si la pauta está vigente o lo estará con el cambio).
function cambiosSensibles(antes, despues) {
  const cambios = [];
  if (antes.descuentoPct !== despues.descuentoPct)
    cambios.push(['Descuento', porcentaje(antes.descuentoPct), porcentaje(despues.descuentoPct)]);
  if (Date.parse(antes.vigenteDesde ?? 0) !== Date.parse(despues.vigenteDesde ?? 0))
    cambios.push(['Vigente desde', fecha(antes.vigenteDesde), fecha(despues.vigenteDesde)]);
  if (Date.parse(antes.vigenteHasta ?? 0) !== Date.parse(despues.vigenteHasta ?? 0))
    cambios.push(['Vigente hasta', fecha(antes.vigenteHasta), fecha(despues.vigenteHasta)]);
  if (antes.activo !== despues.activo)
    cambios.push(['Activa', antes.activo ? 'Sí' : 'No', despues.activo ? 'Sí' : 'No']);
  return cambios;
}

export function PautaForm({ pauta, mutacion, alTerminar, alCancelar }) {
  const editando = Boolean(pauta);
  const [porConfirmar, setPorConfirmar] = useState(null);
  const esquema = useMemo(() => esquemaFormulario(pauta), [pauta]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales(pauta),
  });

  const guardar = (datos) =>
    mutacion.mutate(editando ? { id: pauta.id, ...datos } : datos, { onSuccess: alTerminar });

  const enviar = (datos) => {
    const cambios = editando ? cambiosSensibles(pauta, datos) : [];
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
      {editando ? (
        <p className="text-sm text-tenue">Código: {pauta.codigo}</p>
      ) : (
        <Campo etiqueta="Código" error={errors.codigo} ayuda="No se puede cambiar después">
          <input className={claseControl} {...register('codigo')} />
        </Campo>
      )}
      <Campo etiqueta="Nombre" error={errors.nombre}>
        <input className={claseControl} {...register('nombre')} />
      </Campo>
      <Campo etiqueta="Mensaje para el cliente" error={errors.mensajeCliente}>
        <textarea rows={3} className={claseControl} {...register('mensajeCliente')} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo
          etiqueta="Descuento (%)"
          error={errors.descuentoPct}
          ayuda="Vacío = sin descuento propio de la pauta"
        >
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className={claseControl}
            {...register('descuentoPct', { setValueAs: vacioANull })}
          />
        </Campo>
        <Campo etiqueta="Palabras clave" error={errors.palabrasClave} ayuda="Separadas por comas">
          <input className={claseControl} {...register('palabrasClave')} />
        </Campo>
        <Campo etiqueta="Vigente desde" error={errors.vigenteDesde} ayuda="Vacío = desde ya">
          <input type="datetime-local" className={claseControl} {...register('vigenteDesde')} />
        </Campo>
        <Campo
          etiqueta="Vigente hasta"
          error={errors.vigenteHasta}
          ayuda="Vacío = sin fecha de fin"
        >
          <input type="datetime-local" className={claseControl} {...register('vigenteHasta')} />
        </Campo>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('activo')} /> Activa
      </label>
      <MensajeError error={mutacion.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={mutacion.isPending}>
          {editando ? 'Guardar' : 'Crear pauta'}
        </Boton>
      </div>
    </form>
  );
}
