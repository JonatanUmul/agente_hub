import { z } from 'zod';
import { MODULOS } from './reglas.js';

// Forma de lo que devuelve eco_contexto(modulo). Los objetos son "loose": si la función agrega
// campos nuevos, se conservan y se ven en la vista JSON en lugar de perderse.
const item = z.looseObject({});

export const esquemaContexto = z.looseObject({
  generado_en: z.string(),
  modulo: z.string(),
  precios_habilitados: z.boolean(),
  promociones_habilitadas: z.boolean(),
  configuracion: z.record(z.string(), z.string().nullable()),
  reglas: z.array(item),
  catalogo: z.array(item),
  pautas: z.array(item),
  multimedia: z.array(item),
});

export const esquemaModuloContexto = z.object({ modulo: z.enum(MODULOS) });
