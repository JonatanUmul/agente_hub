import { z } from 'zod';

// Días ISO, igual que eco_agentes_horario.dia_semana (1 = lunes … 7 = domingo).
export const DIAS_SEMANA = [
  { dia: 1, nombre: 'Lunes', corto: 'Lun' },
  { dia: 2, nombre: 'Martes', corto: 'Mar' },
  { dia: 3, nombre: 'Miércoles', corto: 'Mié' },
  { dia: 4, nombre: 'Jueves', corto: 'Jue' },
  { dia: 5, nombre: 'Viernes', corto: 'Vie' },
  { dia: 6, nombre: 'Sábado', corto: 'Sáb' },
  { dia: 7, nombre: 'Domingo', corto: 'Dom' },
];

// La base guarda el fin de los turnos que llegan a medianoche como '24:00' (fin exclusivo).
// Un <input type="time"> no puede escribir 24:00: en la app "23:59" significa "hasta medianoche".
export const FIN_DEL_DIA = '24:00';
export const finParaGuardar = (hora) => (hora === '23:59' ? FIN_DEL_DIA : hora);
export const finParaMostrar = (hora) => (hora === FIN_DEL_DIA ? '23:59' : hora);

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Hora no válida');
const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

export const esquemaRango = z
  .object({ horaInicio: hora, horaFin: hora.transform(finParaGuardar) })
  .refine((r) => minutos(r.horaFin) > minutos(r.horaInicio), {
    path: ['horaFin'],
    message: 'Debe ser posterior a la hora de inicio',
  });

// Un día sin rangos es día de descanso.
const esquemaDia = z
  .object({
    diaSemana: z.number().int().min(1).max(7),
    rangos: z.array(esquemaRango).max(6, 'Máximo 6 rangos por día'),
  })
  .superRefine((d, ctx) => {
    const ordenados = [...d.rangos].sort((a, b) => minutos(a.horaInicio) - minutos(b.horaInicio));
    for (let i = 1; i < ordenados.length; i++) {
      if (minutos(ordenados[i].horaInicio) < minutos(ordenados[i - 1].horaFin)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rangos'],
          message: 'Los rangos de un mismo día no pueden cruzarse',
        });
        return;
      }
    }
  });

export const esquemaGuardarHorario = z.object({
  dias: z
    .array(esquemaDia)
    .length(7)
    .refine((dias) => new Set(dias.map((d) => d.diaSemana)).size === 7, 'Debe incluir los 7 días'),
  version: z.string().min(1),
});

const fecha = z.iso.date('Fecha no válida');

export const esquemaCrearDescanso = z
  .object({
    desde: fecha,
    hasta: fecha,
    motivo: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .transform((t) => (t ? t : null)),
  })
  .refine((d) => d.hasta >= d.desde, {
    path: ['hasta'],
    message: 'Debe ser igual o posterior a "desde"',
  });

export const esquemaDescanso = z.object({
  id: z.number().int(),
  desde: fecha,
  hasta: fecha,
  motivo: z.string().nullable(),
});

export const esquemaAgente = z.object({
  id: z.number().int(),
  nombre: z.string().nullable(),
  apellido: z.string().nullable(),
  email: z.string(),
  bandeja: z.string().nullable(),
  canal: z.string().nullable(),
  estadoAgente: z.string().nullable(),
  // Calculado por la base con eco_agente_en_horario() (hora de Guatemala).
  enHorarioAhora: z.boolean(),
  horario: z.array(
    z.object({
      diaSemana: z.number().int(),
      rangos: z.array(z.object({ horaInicio: z.string(), horaFin: z.string() })),
    }),
  ),
  // Descansos de hoy en adelante.
  descansos: z.array(esquemaDescanso),
  version: z.string(),
});
