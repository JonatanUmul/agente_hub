import { z } from 'zod';
import { fechaIso } from './comunes.js';

// Tablas cuyos cambios registra el trigger eco_auditar() y su nombre para mostrar.
export const TABLAS_AUDITADAS = {
  eco_productos: 'Productos',
  eco_configuracion: 'Interruptores y configuración',
  eco_pautas: 'Pautas',
  eco_multimedia: 'Multimedia',
  eco_reglas_bot: 'Reglas del bot',
  eco_preguntas_frecuentes: 'Preguntas frecuentes',
  eco_frases_cierre: 'Frases de cierre',
  eco_saludos: 'Saludos',
  eco_mensajes: 'Mensajes del bot',
  eco_productos_pautas: 'Pautas de productos',
  eco_multimedia_pautas: 'Pautas de multimedia',
  eco_agentes_horario: 'Horarios de agentes',
  eco_agentes_descanso: 'Descansos de agentes',
};
const nombresTablas = Object.keys(TABLAS_AUDITADAS);

export const OPERACIONES_AUDITORIA = ['INSERT', 'UPDATE', 'DELETE'];

// app = hecho desde esta app (usuario_db eco_app); directo = cualquier otro rol de la base.
export const ORIGENES_AUDITORIA = ['app', 'directo'];

const vacioAUndefined = (valor) => (valor === '' ? undefined : valor);

// Filtros del historial (query string). Todos opcionales.
export const esquemaFiltrosAuditoria = z.object({
  tabla: z.preprocess(vacioAUndefined, z.enum(nombresTablas).optional()),
  operacion: z.preprocess(vacioAUndefined, z.enum(OPERACIONES_AUDITORIA).optional()),
  origen: z.preprocess(vacioAUndefined, z.enum(ORIGENES_AUDITORIA).optional()),
  registroId: z.preprocess(vacioAUndefined, z.string().trim().max(200).optional()),
  usuario: z.preprocess(vacioAUndefined, z.string().trim().toLowerCase().max(200).optional()),
  desde: z.preprocess(vacioAUndefined, fechaIso.optional()),
  hasta: z.preprocess(vacioAUndefined, fechaIso.optional()),
  // Paginación por cursor: trae registros con id menor a este (los más recientes primero).
  antesDe: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

const valorJson = z.unknown();

export const esquemaEntradaAuditoria = z.object({
  id: z.number().int(),
  tabla: z.string(),
  operacion: z.enum(OPERACIONES_AUDITORIA),
  registroId: z.string().nullable(),
  // Texto para reconocer el registro (nombre, título, clave…), sacado de la propia fila.
  etiqueta: z.string().nullable(),
  origen: z.enum(ORIGENES_AUDITORIA),
  // Correo de quien lo hizo en la app; null si fue un cambio directo en la base.
  usuarioApp: z.string().nullable(),
  usuarioDb: z.string(),
  creadoEn: fechaIso,
  cambios: z.array(z.object({ campo: z.string(), antes: valorJson, despues: valorJson })),
});

export const esquemaPaginaAuditoria = z.object({
  entradas: z.array(esquemaEntradaAuditoria),
  // id para pedir la página siguiente (más antigua); null si no hay más.
  siguiente: z.number().int().nullable(),
});
