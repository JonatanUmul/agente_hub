import { Link } from 'react-router-dom';
import {
  INFO_SITUACIONES,
  NOMBRES_MODULO_FRASE,
  SITUACIONES_FRASE,
  resumenFrasesActivas,
} from '@ecofiltro/shared';
import { Tabla } from '../../components/Tabla.jsx';
import { useFrases } from '../frases/hooks.js';
import { Tarjeta } from './Tarjeta.jsx';

// Frases de cierre activas por módulo y situación. No depende del rango de fechas: es el estado actual.
export function FrasesActivas() {
  const { data: frases } = useFrases();
  if (!frases) return null;
  return (
    <Tarjeta
      titulo="Frases de cierre activas"
      acciones={
        <Link to="/frases-cierre" className="text-sm text-acento hover:underline">
          Administrar
        </Link>
      }
    >
      <Tabla
        clave={(f) => f.modulo}
        filas={resumenFrasesActivas(frases)}
        columnas={[
          { titulo: 'Módulo', celda: (f) => NOMBRES_MODULO_FRASE[f.modulo] },
          ...SITUACIONES_FRASE.map((s) => ({
            titulo: INFO_SITUACIONES[s].titulo,
            className: 'text-right tabular-nums',
            celda: (f) => (f[s] === 0 ? <span className="text-apagado">0</span> : f[s]),
          })),
        ]}
      />
    </Tarjeta>
  );
}
