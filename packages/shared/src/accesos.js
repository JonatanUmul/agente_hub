import { z } from 'zod';
import { DIAS_MAXIMOS_REPORTE, diasEntre } from './reportes.js';

// Control de usuarios: entradas y salidas de la app, intentos fallidos y cambios hechos por un admin.

// Cómo terminó una sesión. 'abierta' no se guarda: es una sesión que todavía no vence.
export const MOTIVOS_FIN_SESION = {
  abierta: 'Sigue abierta',
  salida: 'Cerró sesión',
  expirada: 'Dejó la app abierta',
  cerrada_por_admin: 'Cerrada por un admin',
  contrasena: 'Cambio de contraseña',
  desactivado: 'Usuario desactivado',
};

export const EVENTOS_USUARIO = {
  acceso_fallido: 'Acceso fallido',
  bloqueo: 'Cuenta bloqueada',
  creado: 'Usuario creado',
  editado: 'Usuario editado',
  desactivado: 'Usuario desactivado',
  activado: 'Usuario activado',
  contrasena_restablecida: 'Contraseña restablecida',
  contrasena_cambiada: 'Cambió su contraseña',
  sesiones_cerradas: 'Sesiones cerradas',
};

export const MOTIVOS_ACCESO_FALLIDO = {
  contrasena: 'contraseña incorrecta',
  bloqueada: 'cuenta bloqueada',
  inactiva: 'usuario inactivo',
  correo_desconocido: 'correo no registrado',
};

// Minutos sin actividad para dejar de mostrar a alguien «en línea».
export const MINUTOS_EN_LINEA = 5;

const fecha = z.iso.date('Fecha no válida');
const vacioAUndefined = (v) => (v === '' ? undefined : v);

export const esquemaFiltrosAccesos = z
  .object({
    desde: fecha,
    hasta: fecha,
    usuarioId: z.preprocess(vacioAUndefined, z.coerce.number().int().positive().optional()),
  })
  .refine((f) => f.hasta >= f.desde, {
    path: ['hasta'],
    message: 'Debe ser igual o posterior a "desde"',
  })
  .refine((f) => diasEntre(f.desde, f.hasta) <= DIAS_MAXIMOS_REPORTE, {
    path: ['hasta'],
    message: `El rango máximo es de ${DIAS_MAXIMOS_REPORTE} días`,
  });

const instante = z.iso.datetime({ offset: true });

export const esquemaSesionHistorial = z.object({
  id: z.number().int(),
  usuarioId: z.number().int(),
  nombre: z.string(),
  correo: z.string(),
  inicio: instante,
  fin: instante,
  minutos: z.number().int(),
  motivo: z.enum(Object.keys(MOTIVOS_FIN_SESION)),
  enLinea: z.boolean(),
  ip: z.string().nullable(),
  navegador: z.string().nullable(),
});

export const esquemaEventoUsuario = z.object({
  id: z.number().int(),
  usuarioId: z.number().int().nullable(),
  nombre: z.string().nullable(),
  correo: z.string(),
  evento: z.enum(Object.keys(EVENTOS_USUARIO)),
  detalle: z.record(z.string(), z.any()).nullable(),
  hechoPor: z.string().nullable(),
  ip: z.string().nullable(),
  creadoEn: instante,
});

export const esquemaResumenAccesos = z.object({
  usuarioId: z.number().int(),
  nombre: z.string(),
  correo: z.string(),
  sesiones: z.number().int(),
  minutos: z.number().int(),
  primeraEntrada: instante.nullable(),
  ultimaSalida: instante.nullable(),
  fallidos: z.number().int(),
  enLinea: z.boolean(),
});

export const esquemaControlAccesos = z.object({
  resumen: z.array(esquemaResumenAccesos),
  sesiones: z.array(esquemaSesionHistorial),
  eventos: z.array(esquemaEventoUsuario),
});

// «Chrome en Windows» a partir del user-agent. Solo para mostrar; el original se guarda completo.
export function navegadorLegible(userAgent) {
  if (!userAgent) return null;
  const navegador =
    [
      [/Edg\//, 'Edge'],
      [/OPR\/|Opera/, 'Opera'],
      [/Firefox\//, 'Firefox'],
      [/Chrome\//, 'Chrome'],
      [/Safari\//, 'Safari'],
    ].find(([patron]) => patron.test(userAgent))?.[1] ?? 'Otro navegador';
  const sistema =
    [
      [/iPhone|iPad/, 'iPhone/iPad'],
      [/Android/, 'Android'],
      [/Windows/, 'Windows'],
      [/Mac OS X|Macintosh/, 'macOS'],
      [/Linux/, 'Linux'],
    ].find(([patron]) => patron.test(userAgent))?.[1] ?? null;
  return sistema ? `${navegador} en ${sistema}` : navegador;
}

// 95 → «1 h 35 min».
export function duracionLegible(minutos) {
  if (minutos < 1) return 'menos de 1 min';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
