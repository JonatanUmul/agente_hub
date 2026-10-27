import { z } from 'zod';

export const esquemaSalud = z.object({
  estado: z.enum(['ok', 'degradado']),
  baseDatos: z.enum(['ok', 'sin_conexion']),
  hora: z.iso.datetime(),
});
