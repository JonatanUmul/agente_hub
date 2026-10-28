import {
  ETIQUETAS_FICHA,
  TIPOS_POR_CAMPO,
  URL_TIENDA,
  campoAplica,
  esUrlDeLaTienda,
  textoMedidas,
  textoPeso,
} from '@ecofiltro/shared';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { ListaCaracteristicas } from './ListaCaracteristicas.jsx';

// Pestañas Ficha, Medidas y Web del formulario de producto. Reciben `register`, `control` y `errors`
// de React Hook Form, y `enVivo` (los valores que se están escribiendo) para avisos y vistas previas.

export const vacioANull = (valor) => (valor === '' || valor === null ? null : Number(valor));

export function PestanaFicha({ producto, register, control, errors, contradicciones, enVivo }) {
  // Un campo que no aplica a este tipo se oculta, salvo que ya tenga un valor: hay que poder vaciarlo.
  const mostrar = (campo) => campoAplica(campo, producto.tipo) || Boolean(enVivo[campo]);
  const ayudaNoAplica = (campo) =>
    campoAplica(campo, producto.tipo)
      ? undefined
      : `Solo para ${TIPOS_POR_CAMPO[campo].join(' y ')}: déjalo vacío.`;

  return (
    <div className="space-y-4">
      <Campo etiqueta="Descripción corta" error={errors.descripcionCorta}>
        <input className={claseControl} {...register('descripcionCorta')} />
      </Campo>
      <Campo etiqueta="Descripción" error={errors.descripcion}>
        <textarea rows={4} className={claseControl} {...register('descripcion')} />
      </Campo>
      <ListaCaracteristicas
        control={control}
        register={register}
        errors={errors.caracteristicas}
        contradicciones={contradicciones}
      />
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Material" error={errors.material}>
          <input className={claseControl} {...register('material')} />
        </Campo>
        <Campo
          etiqueta="Capacidad"
          error={errors.capacidadTexto}
          ayuda="Como se comunica: «6 L», «500 ml»"
        >
          <input className={claseControl} {...register('capacidadTexto')} />
        </Campo>
        {mostrar('capacidadPurificadorLitros') && (
          <Campo
            etiqueta={`${ETIQUETAS_FICHA.capacidadPurificadorLitros} (L)`}
            error={errors.capacidadPurificadorLitros}
            ayuda={ayudaNoAplica('capacidadPurificadorLitros')}
          >
            <input
              type="number"
              step="0.01"
              min="0"
              className={claseControl}
              {...register('capacidadPurificadorLitros', { setValueAs: vacioANull })}
            />
          </Campo>
        )}
        <Campo
          etiqueta="Tasa de filtrado"
          error={errors.tasaFiltrado}
          ayuda="«1-2 litros por hora»"
        >
          <input className={claseControl} {...register('tasaFiltrado')} />
        </Campo>
      </div>
      {mostrar('compatibleCon') && (
        <Campo
          etiqueta={ETIQUETAS_FICHA.compatibleCon}
          error={errors.compatibleCon}
          ayuda={ayudaNoAplica('compatibleCon')}
        >
          <input className={claseControl} {...register('compatibleCon')} />
        </Campo>
      )}
    </div>
  );
}

const MEDIDAS = [
  ['anchoCm', 'Ancho (cm)'],
  ['altoCm', 'Alto (cm)'],
  ['largoCm', 'Largo (cm)'],
  ['pesoLb', 'Peso (lb)'],
];

export function PestanaMedidas({ register, errors, enVivo }) {
  const medidas = textoMedidas(enVivo);
  const peso = textoPeso(enVivo.pesoLb);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {MEDIDAS.map(([campo, etiqueta]) => (
          <Campo key={campo} etiqueta={etiqueta} error={errors[campo]}>
            <input
              type="number"
              step="0.1"
              min="0"
              className={claseControl}
              {...register(campo, { setValueAs: vacioANull })}
            />
          </Campo>
        ))}
      </div>
      <div className="rounded-md bg-panel-2 p-3 text-sm">
        <p>
          Medidas que verá el cliente:{' '}
          {medidas ? <strong>{medidas}</strong> : <span className="text-tenue">ninguna</span>}
        </p>
        <p>Peso: {peso ? <strong>{peso}</strong> : <span className="text-tenue">sin peso</span>}</p>
      </div>
    </div>
  );
}

export function PestanaWeb({ register, errors, enVivo }) {
  const url = (enVivo.urlWeb ?? '').trim();
  return (
    <div className="space-y-2">
      <Campo etiqueta="Página del producto" error={errors.urlWeb} ayuda={URL_TIENDA}>
        <input
          type="url"
          placeholder={`${URL_TIENDA}producto/…`}
          className={claseControl}
          {...register('urlWeb')}
        />
      </Campo>
      {esUrlDeLaTienda(url) && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center rounded-md border border-borde-fuerte bg-panel-2 px-3 text-sm font-medium hover:bg-borde"
        >
          Abrir la página ↗
        </a>
      )}
    </div>
  );
}
