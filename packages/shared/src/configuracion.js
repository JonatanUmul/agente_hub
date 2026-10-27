import { z } from 'zod';

// Únicas claves de eco_configuracion que la app permite cambiar. El resto son parámetros técnicos
// de los flujos de n8n (bandejas, IDs de HubSpot, tiempos) y cambiarlos por error rompería el bot.
export const INTERRUPTORES = ['precios_habilitados', 'promociones_habilitadas'];

export const esquemaInterruptor = z.object({
  clave: z.enum(INTERRUPTORES),
  descripcion: z.string().nullable(),
  habilitado: z.boolean(),
  actualizadoEn: z.iso.datetime({ offset: true }),
  actualizadoPor: z.string().nullable(),
});

export const esquemaCambiarInterruptor = z.object({ habilitado: z.boolean() });
