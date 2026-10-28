import { Link } from 'react-router-dom';
import { NOMBRES_MODULO_SALUDO, ahoraEnGuatemala, proximaTemporada } from '@ecofiltro/shared';
import { useSaludoVigente, useSaludos } from '../saludos/hooks.js';
import { Tarjeta } from './Tarjeta.jsx';
import { diaCorto } from './formato.js';

// Saludo del menú inicial hoy y la próxima temporada programada.
export function SaludoTemporada() {
  const { data: vigente } = useSaludoVigente('MENU');
  const { data: saludos } = useSaludos();
  const proxima = saludos ? proximaTemporada(saludos, ahoraEnGuatemala().fecha) : null;
  return (
    <Tarjeta
      titulo="Saludo de hoy"
      acciones={
        <Link to="/saludos" className="text-sm text-acento hover:underline">
          Saludos
        </Link>
      }
    >
      <p className="text-sm">{vigente?.saludo ?? '—'}</p>
      <p className="mt-3 text-xs text-tenue">Próxima temporada</p>
      <p className="text-sm">
        {proxima ? (
          <>
            <strong>{proxima.saludo.nombre}</strong> · desde el {diaCorto(proxima.inicio)} ·{' '}
            {NOMBRES_MODULO_SALUDO[proxima.saludo.modulo]}
          </>
        ) : (
          '—'
        )}
      </p>
    </Tarjeta>
  );
}
