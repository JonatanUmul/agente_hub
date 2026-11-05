import { z } from 'zod';
import { INTERRUPTOR_VISION } from './vision.js';

// Únicas claves de eco_configuracion que la app permite cambiar. El resto son parámetros técnicos
// de los flujos de n8n (bandejas, IDs de HubSpot, tiempos) y cambiarlos por error rompería el bot.
export const INTERRUPTORES_COMERCIALES = ['precios_habilitados', 'promociones_habilitadas'];
// cierre_automatico: si el bot agrega una frase de cierre (eco_frases_cierre). Se cambia desde Frases de cierre,
// con el permiso de quien administra el contenido.
export const INTERRUPTORES = [
  ...INTERRUPTORES_COMERCIALES,
  'cierre_automatico',
  'recuperacion_compra_activa',
  'seguimiento_ia_activo',
  INTERRUPTOR_VISION,
];

export const esquemaInterruptor = z.object({
  clave: z.enum(INTERRUPTORES),
  descripcion: z.string().nullable(),
  habilitado: z.boolean(),
  actualizadoEn: z.iso.datetime({ offset: true }),
  actualizadoPor: z.string().nullable(),
});

export const esquemaCambiarInterruptor = z.object({ habilitado: z.boolean() });

// Tiempos y límites del bot (eco_configuracion, tipo entero), agrupados por bloque en la pantalla Tiempos.
// `porDefecto`: el valor que se muestra si la base guarda algo que no es entero (null = sin valor conocido).
const p = (bloque, titulo, unidad, minimo, maximo, ayuda = null, porDefecto = null) => ({
  bloque,
  titulo,
  unidad,
  minimo,
  maximo,
  ayuda,
  porDefecto,
});
export const BLOQUES_TIEMPOS = [
  'Mensajes del cliente',
  'Inactividad y seguimiento',
  'Asesor',
  'Pauta',
  'Contexto del bot',
  'Fotos',
];
export const PARAMETROS_ENTEROS = {
  segundos_agrupar_mensajes: p(
    'Mensajes del cliente',
    'Agrupar mensajes seguidos',
    'segundos',
    0,
    20,
    'Más segundos = junta mejor los mensajes, pero el bot tarda más en responder. 0 = no agrupar.',
    5,
  ),
  segundos_agrupar_saludo: p('Mensajes del cliente', 'Agrupar el saludo', 'segundos', 0, 30),
  minutos_aviso_inactividad: p(
    'Inactividad y seguimiento',
    'Aviso de inactividad',
    'minutos',
    1,
    1440,
  ),
  minutos_cierre_inactividad: p(
    'Inactividad y seguimiento',
    'Cierre por inactividad',
    'minutos',
    1,
    1440,
    'Debe ser mayor que el aviso.',
  ),
  minutos_asesor_recuperacion: p(
    'Inactividad y seguimiento',
    'Ofrecer asesor después del seguimiento',
    'minutos',
    1,
    1440,
  ),
  horas_entre_seguimientos: p('Inactividad y seguimiento', 'Entre seguimientos', 'horas', 1, 720),
  minutos_espera_nombre: p('Asesor', 'Espera del nombre', 'minutos', 1, 120),
  minutos_repetir_pauta: p('Pauta', 'Repetir la pauta', 'minutos', 0, 1440),
  horas_repetir_pauta: p('Pauta', 'Repetir la pauta', 'horas', 0, 720),
  max_fotos_pauta: p(
    'Pauta',
    'Fotos por pauta sin arte',
    'fotos',
    0,
    10,
    'Fotos de producto que se envían cuando la pauta no tiene imagen propia.',
    1,
  ),
  horas_historial_agente: p('Contexto del bot', 'Historial que lee el agente', 'horas', 1, 720),
  max_fotos_por_respuesta: p('Fotos', 'Fotos por respuesta', 'fotos', 0, 10),
  segundos_entre_fotos: p('Fotos', 'Entre fotos', 'segundos', 0, 30),
};
// Interruptores del bloque de inactividad (booleanos en eco_configuracion).
export const INTERRUPTOR_RECUPERACION = 'recuperacion_compra_activa';
export const INTERRUPTOR_SEGUIMIENTO_IA = 'seguimiento_ia_activo';
export const INTERRUPTORES_TIEMPOS = {
  [INTERRUPTOR_SEGUIMIENTO_IA]: {
    titulo: 'Seguimiento con IA',
    descripcion:
      'Cuando el cliente deja de responder, la IA revisa la conversación y envía un seguimiento según el caso, o cierra sin mensaje. Reemplaza el aviso de cierre y el seguimiento de compra.',
  },
  [INTERRUPTOR_RECUPERACION]: { titulo: 'Seguimiento de compra', descripcion: null },
};

// Con el seguimiento con IA encendido, el aviso pasa a ser el momento del seguimiento.
export function textosTiempo(clave, seguimientoIa) {
  const info = PARAMETROS_ENTEROS[clave];
  if (!seguimientoIa) return { titulo: info.titulo, ayuda: info.ayuda };
  if (clave === 'minutos_aviso_inactividad')
    return { titulo: 'Seguimiento cuando deja de responder', ayuda: info.ayuda };
  if (clave === 'minutos_cierre_inactividad')
    return {
      titulo: info.titulo,
      ayuda: 'El cierre ocurre (cierre − aviso) minutos después del seguimiento.',
    };
  return { titulo: info.titulo, ayuda: info.ayuda };
}

// Validación entre claves: el cierre por inactividad debe llegar después del aviso.
export function errorEntreParametros(valores) {
  const aviso = valores.minutos_aviso_inactividad;
  const cierre = valores.minutos_cierre_inactividad;
  if (Number.isInteger(aviso) && Number.isInteger(cierre) && cierre <= aviso) {
    return 'El cierre por inactividad debe ser mayor que el aviso';
  }
  return null;
}

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

// Parámetros de texto editables (eco_configuracion, tipo texto). El resto de textos son de n8n.
export const PARAMETROS_TEXTO = {
  vision_modelo: {
    titulo: 'Modelo para imágenes',
    ayuda: 'Modelo de OpenRouter para imágenes. gemini-2.5-pro fue el más preciso en las pruebas.',
    porDefecto: 'google/gemini-2.5-pro',
  },
};
export const CLAVES_TEXTO = Object.keys(PARAMETROS_TEXTO);

// Identificador de OpenRouter: proveedor/modelo (google/gemini-2.5-pro, openai/gpt-4o:online).
const MODELO_OPENROUTER = /^[a-z0-9][\w.-]*\/[\w.:-]+$/i;
export function errorParametroTexto(clave, valor) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) return 'Requerido';
  if (texto.length > 100) return 'Máximo 100 caracteres';
  if (clave === 'vision_modelo' && !MODELO_OPENROUTER.test(texto))
    return 'Usa el formato proveedor/modelo, como google/gemini-2.5-pro';
  return null;
}

export const esquemaParametroTexto = z.object({
  clave: z.enum(CLAVES_TEXTO),
  valor: z.string().nullable(),
  actualizadoEn: z.iso.datetime({ offset: true }),
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

export const esquemaCambiarParametroTexto = z.object({
  valor: z.string().trim().max(100),
  version: z.string().min(1),
});
