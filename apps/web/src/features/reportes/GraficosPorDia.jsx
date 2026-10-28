import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Boton } from '../../components/Boton.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Tarjeta } from './Tarjeta.jsx';
import { diaCorto, entero } from './formato.js';

// Colores y trazos comunes (tokens de index.css: cambian solos con el modo claro/oscuro).
const EJE = { stroke: 'var(--cuadricula)', tick: { fill: 'var(--tenue)', fontSize: 11 } };
const SERIES = [
  { clave: 'conversaciones', nombre: 'Conversaciones del bot', color: 'var(--serie-1)' },
  { clave: 'transferidas', nombre: 'Transferidas a asesor', color: 'var(--serie-2)' },
];

// Tooltip: el valor primero, la serie después; cada fila con una raya del color de su serie.
function Globo({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-borde bg-panel px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-tenue">{diaCorto(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3" style={{ background: p.color }} />
          <strong className="tabular-nums">{entero(p.value)}</strong>
          <span className="text-tenue">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

function Leyenda() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-tenue">
      {SERIES.map((s) => (
        <span key={s.clave} className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
          {s.nombre}
        </span>
      ))}
    </div>
  );
}

const ejeX = (
  <XAxis dataKey="dia" tickFormatter={diaCorto} minTickGap={24} tickLine={false} {...EJE} />
);
const ejeY = <YAxis allowDecimals={false} width={40} tickLine={false} axisLine={false} {...EJE} />;
const cuadricula = <CartesianGrid vertical={false} stroke="var(--cuadricula)" />;

// Conversaciones y transferencias por día (misma unidad: un eje). Los mensajes de la bandeja tienen otra
// escala (cientos por día): van en su propio gráfico, nunca en un segundo eje.
export function GraficosPorDia({ porDia }) {
  const [verTabla, setVerTabla] = useState(false);
  const alternar = (
    <Boton variante="enlace" onClick={() => setVerTabla(!verTabla)}>
      {verTabla ? 'Ver gráfico' : 'Ver tabla'}
    </Boton>
  );

  if (verTabla) {
    return (
      <Tarjeta titulo="Por día" acciones={alternar} className="lg:col-span-2">
        <Tabla
          clave={(f) => f.dia}
          filas={porDia}
          columnas={[
            { titulo: 'Día', celda: (f) => diaCorto(f.dia) },
            ...SERIES.map((s) => ({
              titulo: s.nombre,
              className: 'text-right tabular-nums',
              celda: (f) => entero(f[s.clave]),
            })),
            {
              titulo: 'Mensajes de la bandeja',
              className: 'text-right tabular-nums',
              celda: (f) => entero(f.mensajes),
            },
          ]}
        />
      </Tarjeta>
    );
  }

  return (
    <>
      <Tarjeta titulo="Conversaciones por día" acciones={alternar}>
        <Leyenda />
        <div className="mt-2 h-60">
          <ResponsiveContainer>
            <LineChart data={porDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              {cuadricula}
              {ejeX}
              {ejeY}
              <Tooltip content={<Globo />} cursor={{ stroke: 'var(--borde-fuerte)' }} />
              {SERIES.map((s) => (
                <Line
                  key={s.clave}
                  dataKey={s.clave}
                  name={s.nombre}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--panel)' }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Mensajes en la bandeja por día">
        <div className="mt-2 h-60">
          <ResponsiveContainer>
            <BarChart data={porDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              {cuadricula}
              {ejeX}
              {ejeY}
              <Tooltip content={<Globo />} cursor={{ fill: 'var(--panel-2)' }} />
              <Bar
                dataKey="mensajes"
                name="Mensajes"
                fill="var(--serie-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>
    </>
  );
}
