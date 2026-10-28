import { z } from 'zod';

// Módulo de reportes (docs/reportes-indicadores.md). Fechas como 'YYYY-MM-DD' en hora de Guatemala;
// la API las convierte en el rango [desde 00:00, hasta + 1 día 00:00).

export const DIAS_MAXIMOS_REPORTE = 365;

// Etapas de `eventos` que identifican el módulo de una conversación.
export const MODULOS_REPORTE = {
  COMPRA: 'comprar_ecofiltro',
  SAC: 'atencion_cliente',
  DISTRIBUIDOR: 'ser_distribuidor',
  PAUTAS: 'pauta',
};

// Tablas del dashboard que se pueden exportar a CSV.
export const TABLAS_EXPORTABLES = [
  'por-dia',
  'agentes',
  'pautas',
  'preguntas',
  'multimedia',
  'detalle',
];

const fecha = z.iso.date('Fecha no válida');
const MS_DIA = 86_400_000;
export const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_DIA) + 1;

const vacioAUndefined = (v) => (v === '' ? undefined : v);

export const esquemaFiltrosReporte = z
  .object({
    desde: fecha,
    hasta: fecha,
    modulo: z.preprocess(vacioAUndefined, z.enum(Object.keys(MODULOS_REPORTE)).optional()),
    bandeja: z.preprocess(vacioAUndefined, z.string().trim().toLowerCase().max(100).optional()),
    agente: z.preprocess(vacioAUndefined, z.string().regex(/^\d+$/, 'Agente no válido').optional()),
  })
  .refine((f) => f.hasta >= f.desde, {
    path: ['hasta'],
    message: 'Debe ser igual o posterior a "desde"',
  })
  .refine((f) => diasEntre(f.desde, f.hasta) <= DIAS_MAXIMOS_REPORTE, {
    path: ['hasta'],
    message: `El rango máximo es de ${DIAS_MAXIMOS_REPORTE} días`,
  });

const sumarDias = (iso, dias) =>
  new Date(Date.parse(iso) + dias * MS_DIA).toISOString().slice(0, 10);

// Periodo inmediatamente anterior, del mismo largo (ej. 30 días contra los 30 previos).
export function periodoAnterior({ desde, hasta }) {
  const largo = diasEntre(desde, hasta);
  return { desde: sumarDias(desde, -largo), hasta: sumarDias(desde, -1) };
}

// Variación en % frente al periodo anterior; null si antes era 0 (no hay base para comparar).
export function variacion(actual, anterior) {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

// Últimos `dias` días terminando hoy (hora de Guatemala), para el filtro por defecto.
export function ultimosDias(dias, hoy = new Date()) {
  const hoyGt = new Date(hoy.getTime() - 6 * 3_600_000).toISOString().slice(0, 10); // Guatemala = UTC-6, sin horario de verano
  return { desde: sumarDias(hoyGt, -(dias - 1)), hasta: hoyGt };
}
