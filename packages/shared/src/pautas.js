import { z } from 'zod';

// Resumen para selectores (Fase 2). La Fase 3 agrega el esquema completo y la edición.
export const esquemaPautaResumen = z.object({
  id: z.number().int(),
  codigo: z.string(),
  nombre: z.string(),
  descuentoPct: z.number().nullable(),
  activo: z.boolean(),
  vigente: z.boolean(),
});
