import { z } from 'zod';
import { fechaIso, version } from './comunes.js';
import { tieneMarkdown } from './frases.js';

// Saludos del primer mensaje del bot (eco_saludos). La base resuelve el de hoy con eco_saludo(modulo);
// aquí está la misma lógica para simular otra fecha y hora.

export const MODULOS_SALUDO = ['GLOBAL', 'MENU', 'COMPRA', 'SAC', 'DISTRIBUIDOR'];
export const NOMBRES_MODULO_SALUDO = {
  GLOBAL: 'Todos',
  MENU: 'Menú inicial',
  COMPRA: 'Compras',
  SAC: 'Atención al cliente',
  DISTRIBUIDOR: 'Distribuidores',
};
export const EMOJIS_SALUDO = ['😊', '🎄', '🎉', '🇬🇹', '💐', '💧', '🙌', '✨', '🎃', '❤️'];
export const COMODIN_MOMENTO = '{momento}';
export const PRIORIDAD_TEMPORADA = 10;
export const MIN_SALUDO = 3;
export const MAX_SALUDO = 300;
export const ZONA_HORARIA = 'America/Guatemala';
// Regla del redactor que dice que la IA ya no escribe el saludo.
export const REGLA_SALUDO = 'REDACCION-SALUDO';

const largo = (texto) => [...texto].length;
const comodinesInvalidos = (texto) =>
  (texto.match(/\{[^}]*\}/g) ?? []).filter((c) => c !== COMODIN_MOMENTO);

const fecha = z.iso.date('Fecha no válida');

export const esquemaSaludo = z.object({
  id: z.number().int(),
  nombre: z.string(),
  modulo: z.enum(MODULOS_SALUDO),
  saludo: z.string(),
  fechaInicio: z.string().nullable(),
  fechaFin: z.string().nullable(),
  repetirAnual: z.boolean(),
  prioridad: z.number().int(),
  activo: z.boolean(),
  vigenteHoy: z.boolean(),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

const camposEditables = {
  nombre: z.string().trim().min(1, 'Requerido').max(100),
  modulo: z.enum(MODULOS_SALUDO),
  saludo: z
    .string()
    .trim()
    .refine((t) => largo(t) >= MIN_SALUDO, `Mínimo ${MIN_SALUDO} caracteres`)
    .refine((t) => largo(t) <= MAX_SALUDO, `Máximo ${MAX_SALUDO} caracteres`)
    .refine((t) => !tieneMarkdown(t), 'Sin Markdown: nada de **, #, __, `, enlaces ni viñetas')
    .refine(
      (t) => comodinesInvalidos(t).length === 0,
      `El único comodín permitido es ${COMODIN_MOMENTO}`,
    ),
  fechaInicio: fecha.nullable(),
  fechaFin: fecha.nullable(),
  repetirAnual: z.boolean(),
  prioridad: z.number('Debe ser un número').int('Debe ser entero').min(-1000).max(1000),
  activo: z.boolean(),
};

// Mismos CHECK que la tabla: fechas ambas o ninguna; sin repetir, fin >= inicio.
const fechasCompletas = (d) => (d.fechaInicio === null) === (d.fechaFin === null);
const rangoValido = (d) => d.fechaInicio === null || d.repetirAnual || d.fechaFin >= d.fechaInicio;
const conFechas = (esquema) =>
  esquema
    .refine(fechasCompletas, { path: ['fechaFin'], message: 'Indica inicio y fin, o ninguna' })
    .refine(rangoValido, {
      path: ['fechaFin'],
      message: 'Debe ser igual o posterior a la fecha de inicio',
    });

export const esquemaCrearSaludo = conFechas(z.object(camposEditables));
export const esquemaEditarSaludo = conFechas(z.object({ ...camposEditables, version }));
export const esquemaEliminarSaludo = z.object({ version });

const vacioAUndefined = (v) => (v === '' ? undefined : v);
export const esquemaFiltrosSaludos = z.object({
  modulo: z.preprocess(vacioAUndefined, z.enum(MODULOS_SALUDO).optional()),
  activo: z.preprocess(vacioAUndefined, z.enum(['true', 'false']).optional()),
  vigentesHoy: z.preprocess(vacioAUndefined, z.enum(['true', 'false']).optional()),
});
export const esquemaModuloSaludo = z.object({ modulo: z.enum(MODULOS_SALUDO) });
export const esquemaSimularSaludo = z.object({
  modulo: z.enum(MODULOS_SALUDO),
  fecha,
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no válida (HH:MM)'),
});
export const esquemaSaludoGuardado = esquemaSaludo.extend({
  choques: z.array(z.object({ id: z.number().int(), nombre: z.string() })),
});
export const esquemaSaludoVigente = z.object({
  modulo: z.enum(MODULOS_SALUDO),
  saludo: z.string().nullable(),
});
export const esquemaSimulacionSaludo = z.object({
  modulo: z.enum(MODULOS_SALUDO),
  fecha: z.string(),
  hora: z.string(),
  momento: z.string(),
  saludo: z.string().nullable(),
  candidatos: z.array(
    z.object({
      id: z.number().int(),
      nombre: z.string(),
      modulo: z.enum(MODULOS_SALUDO),
      prioridad: z.number().int(),
      saludo: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------- Lógica de eco_saludo()

const mesDia = (iso) => iso.slice(5, 10); // 'YYYY-MM-DD' → 'MM-DD'

// ¿Aplica el saludo en `dia` ('YYYY-MM-DD')? Sin fechas = siempre. Anual: solo mes y día, puede cruzar
// de diciembre a enero. Exacto: entre las dos fechas, inclusive.
export function vigenteEn(s, dia) {
  if (s.fechaInicio === null || s.fechaFin === null) return true;
  if (!s.repetirAnual) return s.fechaInicio <= dia && dia <= s.fechaFin;
  const [ini, fin, hoy] = [mesDia(s.fechaInicio), mesDia(s.fechaFin), mesDia(dia)];
  return ini <= fin ? ini <= hoy && hoy <= fin : hoy >= ini || hoy <= fin;
}

// 5:00–11:59 días, 12:00–18:59 tardes, el resto noches.
export function momentoDelDia(hora) {
  const h = Number(hora.slice(0, 2));
  if (h >= 5 && h <= 11) return 'Buenos días';
  if (h >= 12 && h <= 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export const resolverSaludo = (texto, hora) =>
  texto.replaceAll(COMODIN_MOMENTO, momentoDelDia(hora));

// Candidatos que empatan en el primer lugar, igual que eco_saludo(): activos de GLOBAL + el módulo,
// vigentes ese día; gana la mayor prioridad y, a igual prioridad, el del módulo sobre GLOBAL. Si quedan
// varios, el bot elige uno al azar (por eso se devuelven todos).
export function candidatosSaludo(saludos, modulo, dia) {
  const posibles = saludos.filter(
    (s) => s.activo && (s.modulo === 'GLOBAL' || s.modulo === modulo) && vigenteEn(s, dia),
  );
  if (posibles.length === 0) return [];
  const rango = (s) => [s.prioridad, s.modulo === modulo ? 1 : 0];
  const [p, propio] = posibles.map(rango).sort((a, b) => b[0] - a[0] || b[1] - a[1])[0];
  return posibles.filter((s) => rango(s)[0] === p && rango(s)[1] === propio);
}

// ¿Hay un saludo base (activo, sin fechas) que cubra el módulo cuando no hay temporada?
export const tieneSaludoBase = (saludos, modulo) =>
  saludos.some(
    (s) =>
      s.activo &&
      s.fechaInicio === null &&
      (s.modulo === 'GLOBAL' || modulo === undefined || s.modulo === modulo),
  );

// Fecha de hoy y hora actual en Guatemala.
export function ahoraEnGuatemala(ahora = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(ahora)
      .map((p) => [p.type, p.value]),
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
}

// ---------------------------------------------------------------- Choques y calendario

const MS_DIA = 86_400_000;
const sumarDias = (iso, n) => new Date(Date.parse(iso) + n * MS_DIA).toISOString().slice(0, 10);
function diasEntre(desde, hasta) {
  const dias = [];
  for (let d = desde; d <= hasta && dias.length < 800; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

// Días en que aplica un saludo con fechas (anual: dos años desde `hoy`, para cubrir los que cruzan de año).
function diasDe(s, hoy) {
  if (!s.repetirAnual) return diasEntre(s.fechaInicio, s.fechaFin);
  const anio = Number(hoy.slice(0, 4));
  return diasEntre(`${anio}-01-01`, `${anio + 1}-12-31`).filter((d) => vigenteEn(s, d));
}

// Otros saludos activos del mismo módulo y prioridad que coinciden en algún día: el bot elegiría al azar.
export function choquesDeSaludo(saludo, saludos, hoy) {
  const rivales = saludos.filter(
    (o) =>
      o.id !== saludo.id &&
      o.activo &&
      o.modulo === saludo.modulo &&
      o.prioridad === saludo.prioridad,
  );
  if (!saludo.activo || rivales.length === 0) return [];
  const siempre = (s) => s.fechaInicio === null || s.fechaFin === null;
  if (siempre(saludo)) return rivales;
  const dias = diasDe(saludo, hoy);
  return rivales.filter((o) => siempre(o) || dias.some((d) => vigenteEn(o, d)));
}

// Próxima temporada (con fechas, activa) que empieza después de `hoy`: { saludo, inicio }.
export function proximaTemporada(saludos, hoy) {
  const anio = Number(hoy.slice(0, 4));
  return (
    saludos
      .filter((s) => s.activo && s.fechaInicio !== null)
      .flatMap((s) => {
        const inicios = s.repetirAnual
          ? [`${anio}${s.fechaInicio.slice(4)}`, `${anio + 1}${s.fechaInicio.slice(4)}`]
          : [s.fechaInicio];
        const proximo = inicios.find((i) => i > hoy);
        return proximo ? [{ saludo: s, inicio: proximo }] : [];
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null
  );
}

// Vigencia legible: «Siempre», «Cada año del 15 dic al 26 dic», «Del 1 nov al 3 nov 2026».
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaMes = (iso) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
export function vigenciaLegible(s) {
  if (s.fechaInicio === null) return 'Siempre';
  if (s.repetirAnual) return `Cada año del ${diaMes(s.fechaInicio)} al ${diaMes(s.fechaFin)}`;
  const anioIni = s.fechaInicio.slice(0, 4);
  const anioFin = s.fechaFin.slice(0, 4);
  return anioIni === anioFin
    ? `Del ${diaMes(s.fechaInicio)} al ${diaMes(s.fechaFin)} ${anioFin}`
    : `Del ${diaMes(s.fechaInicio)} ${anioIni} al ${diaMes(s.fechaFin)} ${anioFin}`;
}
