import { INTERRUPTOR_VISION, TIPOS_CON_VISION } from '@ecofiltro/shared';
import { MensajeError } from '../../components/MensajeError.jsx';
import { useEstadoInterruptores, useTextosConfiguracion } from '../configuracion/hooks.js';
import { MiniaturaFoto } from '../productos/PestanaImagen.jsx';
import { useProductos } from '../productos/hooks.js';

// Solo lectura: pistas y fotos de referencia que recibe el identificador de imágenes (flujo Analizar_imagen),
// leídas de eco_productos. Incluye agotados y descontinuados: sirven para reconocer equipos viejos.
export function IdentificacionPorImagen() {
  const { data: productos, error } = useProductos();
  const { estado } = useEstadoInterruptores();
  const { data: textos = [] } = useTextosConfiguracion();
  const modelo = textos.find((t) => t.clave === 'vision_modelo')?.valor;
  const conReferencia = (productos ?? []).filter(
    (p) => TIPOS_CON_VISION.includes(p.tipo) && (p.pistasVisuales || p.fotosReferencia.length > 0),
  );

  return (
    <section className="space-y-3 rounded-lg border border-borde bg-panel p-4">
      <div>
        <h3 className="font-medium">Identificación por imagen</h3>
        <p className="text-xs text-tenue">
          {estado[INTERRUPTOR_VISION] ? 'Encendida' : 'Apagada'}
          {modelo && (
            <>
              {' '}
              · <span className="font-mono">{modelo}</span>
            </>
          )}{' '}
          · {conReferencia.length} producto(s) con referencia
        </p>
      </div>
      <MensajeError error={error} />
      {productos && conReferencia.length === 0 && (
        <p className="text-sm text-apagado">Ningún producto tiene pistas ni fotos de referencia.</p>
      )}
      <ul className="divide-y divide-borde">
        {conReferencia.map((p) => (
          <li key={p.id} className="space-y-1 py-2">
            <p className="text-sm font-medium">
              {p.nombre}{' '}
              <span className="font-mono text-[11px] font-normal text-apagado">{p.codigo}</span>
              {p.estado !== 'disponible' && (
                <span className="ml-2 text-xs font-normal text-tenue">{p.estado}</span>
              )}
              {!p.activo && <span className="ml-2 text-xs font-normal text-tenue">inactivo</span>}
            </p>
            <p className="text-sm text-tenue">{p.pistasVisuales ?? 'Sin pistas visuales'}</p>
            {p.fotosReferencia.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.fotosReferencia.map((f) => (
                  <figure key={f.url} className="space-y-0.5 text-center text-[11px] text-tenue">
                    <MiniaturaFoto url={f.url} color={f.color} />
                    {f.color && <figcaption>{f.color}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
