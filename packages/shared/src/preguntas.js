import { z } from 'zod';
import {
  fechaIso,
  listaDeTextos,
  orden,
  textoOpcional,
  textoRequerido,
  version,
} from './comunes.js';
import { MODULOS } from './reglas.js';

export const esquemaPregunta = z.object({
  id: z.number().int(),
  numero: z.number().int(),
  pregunta: z.string(),
  tema: z.string().nullable(),
  palabrasClave: z.array(z.string()),
  respuesta: z.string(),
  modulos: z.array(z.string()),
  orden: z.number().int(),
  activo: z.boolean(),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

const camposEditables = {
  pregunta: textoRequerido(1000),
  tema: textoOpcional(100),
  palabrasClave: listaDeTextos,
  respuesta: textoRequerido(10_000),
  // La base no restringe los valores; la app usa los mismos módulos que eco_reglas_bot.
  modulos: z
    .array(z.enum(MODULOS))
    .min(1, 'Elige al menos un módulo')
    .transform((lista) => [...new Set(lista)]),
  orden,
  activo: z.boolean(),
};

// El número no se cambia después de crear: la auditoría identifica cada pregunta por su número.
export const esquemaCrearPregunta = z.object({
  numero: z.number('Debe ser un número').int('Debe ser entero').positive('Debe ser mayor que 0'),
  ...camposEditables,
});

export const esquemaEditarPregunta = z.object({ ...camposEditables, version });
