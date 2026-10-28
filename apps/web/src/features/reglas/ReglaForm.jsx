import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DESTINOS,
  INFO_DESTINOS,
  MODULOS,
  REGLA_CIERRE,
  agentesAfectados,
  esquemaCrearRegla,
  esquemaEditarRegla,
} from '@ecofiltro/shared';
import { Link } from 'react-router-dom';
import { Boton } from '../../components/Boton.jsx';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { MensajeError } from '../../components/MensajeError.jsx';
import { TablaCambios } from '../../components/TablaCambios.jsx';
import { fecha } from '../../lib/formato.js';
import { isoALocal, localAIso } from '../../lib/fechas.js';

// Reglas que leen varios agentes (o el orquestador, que decide todo el flujo): cualquier cambio se confirma.
const DESTINOS_DE_ALTO_IMPACTO = ['TODOS', 'ORQUESTADOR'];

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
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(esquema), defaultValues: valoresIniciales(regla) });
  const [modulo, destino, texto] = useWatch({ control, name: ['modulo', 'destino', 'regla'] });
  const esOrquestador = destino === 'ORQUESTADOR';

  // El orquestador solo lee reglas GLOBAL: al elegirlo, el módulo se fija (la API también lo valida).
  useEffect(() => {
    if (esOrquestador && modulo !== 'GLOBAL')
      setValue('modulo', 'GLOBAL', { shouldValidate: true });
  }, [esOrquestador, modulo, setValue]);

  const guardar = (datos) =>
    mutacion.mutate(editando ? { id: regla.id, ...datos } : datos, { onSuccess: alTerminar });
  const enviar = (datos) => {
    const cambios = editando ? cambiosSensibles(regla, datos) : [];
    const altoImpacto =
      editando && [regla.destino, datos.destino].some((d) => DESTINOS_DE_ALTO_IMPACTO.includes(d));
    if (cambios.length > 0 || altoImpacto) {
      const agentes = [
        ...new Set([...agentesAfectados(regla ?? datos), ...agentesAfectados(datos)]),
      ];
      setPorConfirmar({ datos, cambios, agentes });
    } else guardar(datos);
  };

  if (porConfirmar) {
    return (
      <div className="space-y-4 text-sm">
        <p>Estos cambios aplican en el siguiente mensaje de cada cliente.</p>
        {porConfirmar.cambios.length > 0 && <TablaCambios cambios={porConfirmar.cambios} />}
        <div className="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2">
          <p className="mb-1 font-medium text-alerta">Agentes afectados</p>
          <ul className="list-inside list-disc text-texto">
            {porConfirmar.agentes.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
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
        <>
          <p className="text-sm text-tenue">Código: {regla.codigo}</p>
          {regla.codigo === REGLA_CIERRE && (
            <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm">
              La IA ya no escribe el cierre de los mensajes. Las frases de cierre se administran en{' '}
              <Link to="/frases-cierre" className="text-acento underline">
                Frases de cierre
              </Link>
              .
            </p>
          )}
        </>
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
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-tenue">
          Destino: qué agentes la leen
        </legend>
        <div className="divide-y divide-borde rounded-md border border-borde-fuerte">
          {DESTINOS.map((d) => (
            <label
              key={d}
              className={`flex cursor-pointer items-start gap-3 px-3 py-2 ${destino === d ? 'bg-acento/10' : 'hover:bg-panel-2'}`}
            >
              <input type="radio" value={d} className="mt-1" {...register('destino')} />
              <span className="min-w-0">
                <span className="font-mono text-xs font-medium">{d}</span>
                <span className="text-sm"> · {INFO_DESTINOS[d].agentes}</span>
                <span className="block text-xs text-tenue">{INFO_DESTINOS[d].para}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.destino && (
          <span className="mt-1 block text-xs text-peligro">{errors.destino.message}</span>
        )}
      </fieldset>
      <div className="grid grid-cols-2 gap-4">
        <Campo
          etiqueta="Módulo"
          error={errors.modulo}
          ayuda={
            esOrquestador
              ? 'Fijo en GLOBAL: el orquestador decide el módulo antes de conocerlo.'
              : modulo === 'GLOBAL'
                ? 'Aplica en todos los módulos'
                : `Aplica solo en conversaciones de ${modulo}`
          }
        >
          {/* Con ORQUESTADOR se muestra fijo (un <select disabled> no se enviaría): el valor ya es GLOBAL. */}
          {esOrquestador ? (
            <div className={`${claseControl} cursor-not-allowed text-tenue`}>GLOBAL</div>
          ) : (
            <select className={claseControl} {...register('modulo')}>
              {MODULOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          )}
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
      <Campo etiqueta="Categoría" error={errors.categoria} ayuda="Elige una existente para agrupar">
        <input list="categorias-reglas" className={claseControl} {...register('categoria')} />
        <datalist id="categorias-reglas">
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Campo>
      <Campo
        etiqueta="Regla"
        error={errors.regla}
        ayuda={`Texto exacto que recibe el bot · ${(texto ?? '').length.toLocaleString('es-GT')} caracteres`}
      >
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
