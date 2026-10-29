import { z } from 'zod';

// Únicas claves de eco_configuracion que la app permite cambiar. El resto son parámetros técnicos
// de los flujos de n8n (bandejas, IDs de HubSpot, tiempos) y cambiarlos por error rompería el bot.
export const INTERRUPTORES_COMERCIALES = ['precios_habilitados', 'promociones_habilitadas'];
// cierre_automatico: si el bot agrega una frase de cierre (eco_frases_cierre). Se cambia desde Frases de cierre,
// con el permiso de quien administra el contenido.
export const INTERRUPTORES = [...INTERRUPTORES_COMERCIALES, 'cierre_automatico'];

export const esquemaInterruptor = z.object({
  clave: z.enum(INTERRUPTORES),
  descripcion: z.string().nullable(),
  habilitado: z.boolean(),
  actualizadoEn: z.iso.datetime({ offset: true }),
  actualizadoPor: z.string().nullable(),
});

export const esquemaCambiarInterruptor = z.object({ habilitado: z.boolean() });

// Parámetros numéricos del bot que se editan en Interruptores (eco_configuracion, tipo entero).
export const PARAMETROS_ENTEROS = {
  max_fotos_pauta: {
    titulo: 'Fotos por pauta sin arte',
    ayuda: 'Fotos de producto que se envían cuando la pauta no tiene imagen propia.',
    minimo: 0,
    maximo: 10,
    porDefecto: 1,
  },
  segundos_agrupar_mensajes: {
    titulo: 'Segundos para agrupar mensajes',
    ayuda:
      'Más segundos = junta mejor los mensajes, pero el bot tarda más en responder. 0 = responde cada mensaje por separado.',
    minimo: 0,
    maximo: 20,
    porDefecto: 5,
  },
};
export const CLAVES_PARAMETROS = Object.keys(PARAMETROS_ENTEROS);

export const esquemaParametro = z.object({
  clave: z.enum(CLAVES_PARAMETROS),
  // null si el texto guardado no es un entero (se muestra el valor por defecto que usa el bot).
  valor: z.number().int().nullable(),
  actualizadoEn: z.iso.datetime({ offset: true }),
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

// El rango depende de la clave: se valida en el service con `validarParametro`.
export const esquemaCambiarParametro = z.object({
  valor: z.number('Debe ser un número').int('Debe ser entero'),
  version: z.string().min(1),
});

export function errorParametro(clave, valor) {
  const { minimo, maximo } = PARAMETROS_ENTEROS[clave];
  if (!Number.isInteger(valor)) return 'Debe ser entero';
  if (valor < minimo || valor > maximo) return `Debe estar entre ${minimo} y ${maximo}`;
  return null;
}
