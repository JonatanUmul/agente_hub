import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DESTINOS, MODULOS, esquemaCrearRegla, esquemaEditarRegla } from '@ecofiltro/shared';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { TablaCambios } from '../../components/TablaCambios.jsx';
import { fecha } from '../../lib/formato.js';
import { isoALocal, localAIso } from '../../lib/fechas.js';

const DESCRIPCION_DESTINO = {
  TODOS: 'todos los agentes',
  ENRUTADOR: 'el agente que decide a qué flujo va el cliente',
  REDACTOR: 'el agente que redacta la respuesta',
};

// Fechas en hora local en el formulario; se validan con el MISMO esquema de shared que usa la API.
const desdeFormulario = (d) => ({
  ...d,
  vigenteDesde: localAIso(d.vigenteDesde),
  vigenteHasta: localAIso(d.vigenteHasta),
});
function esquemaFormulario(regla) {
  if (!regla) return z.any().transform(desdeFormulario).pipe(esquemaCrearRegla);
  return z
    .any()
    .transform((d) => ({ ...desdeFormulario(d), version: regla.version }))
    .pipe(esquemaEditarRegla);
}

const valoresIniciales = (r) => ({
  codigo: r?.codigo ?? '',
  modulo: r?.modulo ?? 'GLOBAL',
  destino: r?.destino ?? 'TODOS',
  categoria: r?.categoria ?? '',
  titulo: r?.titulo ?? '',
  regla: r?.regla ?? '',
  prioridad: r?.prioridad ?? 50,
  activo: r?.activo ?? true,
  vigenteDesde: isoALocal(r?.vigenteDesde),
  vigenteHasta: isoALocal(r?.vigenteHasta),
});

// Cambios que alteran dónde o si la regla aplica: piden confirmación.
function cambiosSensibles(antes, despues) {
  const cambios = [];
  if (antes.activo && !despues.activo)
    cambios.push(['Activa', 'Sí', 'No (el bot deja de seguirla)']);
  if (antes.modulo !== despues.modulo) cambios.push(['Módulo', antes.modulo, despues.modulo]);
  if (antes.destino !== despues.destino) cambios.push(['Destino', antes.destino, despues.destino]);
  if (Date.parse(antes.vigenteDesde ?? 0) !== Date.parse(despues.vigenteDesde ?? 0))
    cambios.push(['Vigente desde', fecha(antes.vigenteDesde), fecha(despues.vigenteDesde)]);
  if (Date.parse(antes.vigenteHasta ?? 0) !== Date.parse(despues.vigenteHasta ?? 0))
    cambios.push(['Vigente hasta', fecha(antes.vigenteHasta), fecha(despues.vigenteHasta)]);
  return cambios;
}

export function ReglaForm({ regla, categorias, mutacion, alTerminar, alCancelar }) {
  const editando = Boolean(regla);
  const [porConfirmar, setPorConfirmar] = useState(null);
  const esquema = useMemo(() => esquemaFormulario(regla), [regla]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquema), defaultValues: valoresIniciales(regla) });
  const [modulo, destino] = useWatch({ control, name: ['modulo', 'destino'] });

  const guardar = (datos) =>
    mutacion.mutate(editando ? { id: regla.id, ...datos } : datos, { onSuccess: alTerminar });
  const enviar = (datos) => {
    const cambios = editando ? cambiosSensibles(regla, datos) : [];
    if (cambios.length > 0) setPorConfirmar({ datos, cambios });
    else guardar(datos);
  };

  if (porConfirmar) {
    return (
      <div className="space-y-4 text-sm">
        <p>Estos cambios aplican en el siguiente mensaje de cada cliente:</p>
        <TablaCambios cambios={porConfirmar.cambios} />
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
        <p className="text-sm text-slate-600">Código: {regla.codigo}</p>
      ) : (
        <Campo
          etiqueta="Código"
          error={errors.codigo}
          ayuda="El bot lo recibe; no se puede cambiar después"
        >
          <input className={claseControl} {...register('codigo')} />
        </Campo>
      )}
      <Campo
        etiqueta="Título"
        error={errors.titulo}
        ayuda="Solo para identificarla aquí: el bot no lo recibe"
      >
        <input className={claseControl} {...register('titulo')} />
      </Campo>
      <div className="grid grid-cols-3 gap-4">
        <Campo etiqueta="Módulo" error={errors.modulo}>
          <select className={claseControl} {...register('modulo')}>
            {MODULOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Destino" error={errors.destino}>
          <select className={claseControl} {...register('destino')}>
            {DESTINOS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Prioridad" error={errors.prioridad} ayuda="Menor = primero">
          <input
            type="number"
            step="1"
            className={claseControl}
            {...register('prioridad', { valueAsNumber: true })}
          />
        </Campo>
      </div>
      <p className="text-xs text-slate-500">
        {modulo === 'GLOBAL' ? 'Aplica en todos los módulos' : `Aplica solo en el módulo ${modulo}`}
        , para {DESCRIPCION_DESTINO[destino]}.
      </p>
      <Campo etiqueta="Categoría" error={errors.categoria} ayuda="Elige una existente para agrupar">
        <input list="categorias-reglas" className={claseControl} {...register('categoria')} />
        <datalist id="categorias-reglas">
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Campo>
      <Campo etiqueta="Regla" error={errors.regla} ayuda="Texto exacto que recibe el bot">
        <textarea rows={6} className={`${claseControl} font-mono text-sm`} {...register('regla')} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
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
          {editando ? 'Guardar' : 'Crear regla'}
        </Boton>
      </div>
    </form>
  );
}
