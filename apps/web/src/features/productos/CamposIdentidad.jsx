import { TIPOS_PRODUCTO, normalizarItemCode } from '@ecofiltro/shared';
import { Campo, claseControl } from '../../components/Campo.jsx';
import { vacioANull } from './CamposFicha.jsx';

// ItemCode, nombre, tipo, familia, variante y nombre corto. Al editar, nombre, tipo y familia no cambian.
// El ItemCode se escribe en mayúsculas y sin espacios mientras se teclea.
export function CamposIdentidad({ producto, register, errors }) {
  const creando = !producto;
  const codigo = register('codigo');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Campo
          etiqueta="ItemCode"
          error={errors.codigo}
          ayuda={creando ? 'A-Z, 0-9, guion y punto' : 'Cambiarlo pide confirmación'}
        >
          <input
            className={`${claseControl} font-mono`}
            {...codigo}
            onChange={(e) => {
              e.target.value = normalizarItemCode(e.target.value);
              return codigo.onChange(e);
            }}
          />
        </Campo>
        {creando ? (
          <Campo etiqueta="Nombre" error={errors.nombre}>
            <input className={claseControl} {...register('nombre')} />
          </Campo>
        ) : (
          <div className="text-sm">
            <p className="mb-1.5 text-xs font-medium text-tenue">Producto</p>
            <p>{producto.nombre}</p>
            <p className="text-xs text-tenue">
              {producto.tipo} · {producto.familia}
            </p>
          </div>
        )}
        {creando && (
          <>
            <Campo etiqueta="Tipo" error={errors.tipo}>
              <select className={claseControl} {...register('tipo')}>
                {TIPOS_PRODUCTO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Familia" error={errors.familia} ayuda="Ej.: CERAMICA, LLAVE">
              <input className={claseControl} {...register('familia')} />
            </Campo>
          </>
        )}
        <Campo etiqueta="Variante" error={errors.variante} ayuda="Ej.: Flor Azul, Marfil">
          <input className={claseControl} {...register('variante')} />
        </Campo>
        <Campo
          etiqueta="Nombre corto"
          error={errors.nombreCorto}
          ayuda="Cómo lo nombra el bot en una lista. Vacío = el nombre"
        >
          <input className={claseControl} {...register('nombreCorto')} />
        </Campo>
        {creando && (
          <Campo etiqueta="Capacidad (L)" error={errors.capacidadLitros} ayuda="Opcional">
            <input
              type="number"
              step="0.01"
              min="0"
              className={claseControl}
              {...register('capacidadLitros', { setValueAs: vacioANull })}
            />
          </Campo>
        )}
      </div>
    </div>
  );
}
