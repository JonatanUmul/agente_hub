import { z } from 'zod';
import {
  ESTADOS_VIGENCIA,
  errorVigencia,
  fechaIso,
  textoRequerido,
  vigenciaValida,
  version,
} from './comunes.js';

// Valores permitidos por los CHECK de eco_reglas_bot.
export const MODULOS = ['GLOBAL', 'SAC', 'COMPRA', 'DISTRIBUIDOR', 'PAUTAS'];
export const DESTINOS = ['TODOS', 'ENRUTADOR', 'SELECTOR', 'REDACTOR', 'ORQUESTADOR', 'VISION'];

// Qué agentes de n8n leen cada destino y para qué sirve (lo muestra la app al elegir el destino).
// Cada agente recibe las reglas de su destino y después las de TODOS (flujo CONTEXTO_NEGOCIO).
export const INFO_DESTINOS = {
  TODOS: {
    agentes: 'Todos los agentes',
    para: 'Reglas generales: contexto, exactitud, productos, asesor',
  },
  ENRUTADOR: {
    agentes: 'Analizador de ramas (COMPRA y SAC)',
    para: 'Qué ruta atiende el mensaje: tienda, detalle, FAQ, foto, video, asesor…',
  },
  SELECTOR: {
    agentes: 'Identificador de modelo, selector de video, FAQ de SAC',
    para: 'Cómo identificar productos, fotos y videos del catálogo',
  },
  REDACTOR: {
    agentes: 'Redactor final, agente de tienda, FAQ de COMPRA',
    para: 'Tono, estilo, listas, precios, cierre de mensajes',
  },
  ORQUESTADOR: {
    agentes: 'Orquestador central',
    para: 'Clasificar el mensaje en compra, atención o distribuidor. Solo lee reglas GLOBAL',
  },
  VISION: {
    agentes: 'Análisis de fotos enviadas por el cliente (en preparación)',
    para: 'Cómo describir y validar una imagen',
  },
};

// El orquestador clasifica el mensaje ANTES de saber el módulo: solo puede leer reglas GLOBAL.
export const ORQUESTADOR_SOLO_GLOBAL = (d) => d.destino !== 'ORQUESTADOR' || d.modulo === 'GLOBAL';
const errorOrquestador = {
  path: ['modulo'],
  message: 'El orquestador solo lee reglas GLOBAL: decide el módulo antes de conocerlo',
};

// Módulos de conversación (los que n8n pasa a eco_contexto) y límite de texto recomendado por agente.
export const MODULOS_CONVERSACION = ['SAC', 'COMPRA', 'DISTRIBUIDOR'];
export const LIMITE_CARACTERES_AGENTE = 12_000;

export const esquemaRegla = z.object({
  id: z.number().int(),
  codigo: z.string(),
  modulo: z.enum(MODULOS),
  destino: z.enum(DESTINOS),
  categoria: z.string(),
  titulo: z.string(),
  regla: z.string(),
  prioridad: z.number().int(),
  activo: z.boolean(),
  vigenteDesde: fechaIso.nullable(),
  vigenteHasta: fechaIso.nullable(),
  vigente: z.boolean(),
  estadoVigencia: z.enum(ESTADOS_VIGENCIA),
  actualizadoEn: fechaIso,
  actualizadoPor: z.string().nullable(),
  version: z.string(),
});

const camposEditables = {
  modulo: z.enum(MODULOS),
  destino: z.enum(DESTINOS),
  categoria: textoRequerido(100),
  titulo: textoRequerido(200),
  regla: textoRequerido(10_000),
  prioridad: z.number('Debe ser un número').int('Debe ser entero').min(-100_000).max(100_000),
  activo: z.boolean(),
  vigenteDesde: fechaIso.nullable(),
  vigenteHasta: fechaIso.nullable(),
};

// El código no se cambia después de crear: eco_contexto() lo entrega al bot.
export const esquemaCrearRegla = z
  .object({ codigo: textoRequerido(100), ...camposEditables })
  .refine(vigenciaValida, errorVigencia)
  .refine(ORQUESTADOR_SOLO_GLOBAL, errorOrquestador);

export const esquemaEditarRegla = z
  .object({ ...camposEditables, version })
  .refine(vigenciaValida, errorVigencia)
  .refine(ORQUESTADOR_SOLO_GLOBAL, errorOrquestador);

// En qué llamadas a eco_contexto(modulo) aparece una regla: las GLOBAL en todas, las demás solo
// en la de su módulo. Solo si está activa y vigente (vista eco_v_reglas_activas).
export function contextosDeRegla({ modulo, vigente }) {
  if (!vigente) return [];
  return modulo === 'GLOBAL' ? [...MODULOS] : [modulo];
}

// Qué recibe cada agente: por destino (salvo TODOS) y por módulo de conversación, las reglas vigentes
// propias + las de TODOS, siempre de GLOBAL más ese módulo. El orquestador solo recibe GLOBAL.
// `reglas` = lista de la API (con `vigente`). Devuelve una fila por destino y módulo, con sus advertencias.
export function resumenPorAgente(reglas) {
  const vigentes = reglas.filter((r) => r.vigente);
  const de = (destino, modulos) =>
    vigentes.filter((r) => r.destino === destino && modulos.includes(r.modulo));
  const caracteres = (lista) => lista.reduce((total, r) => total + r.regla.length, 0);

  return DESTINOS.filter((d) => d !== 'TODOS').flatMap((destino) => {
    const casos =
      destino === 'ORQUESTADOR'
        ? [{ modulo: 'GLOBAL', modulos: ['GLOBAL'] }]
        : MODULOS_CONVERSACION.map((m) => ({ modulo: m, modulos: ['GLOBAL', m] }));
    return casos.map(({ modulo, modulos }) => {
      const propias = de(destino, modulos);
      const generales = de('TODOS', modulos);
      const total = caracteres(propias) + caracteres(generales);
      return {
        destino,
        modulo,
        propias: propias.length,
        generales: generales.length,
        caracteres: total,
        sinPropias: propias.length === 0,
        excedeLimite: total > LIMITE_CARACTERES_AGENTE,
      };
    });
  });
}

// Agentes afectados por una regla (para confirmar al editarla o desactivarla).
export function agentesAfectados({ destino }) {
  if (destino === 'TODOS')
    return DESTINOS.filter((d) => d !== 'TODOS').map((d) => INFO_DESTINOS[d].agentes);
  return [INFO_DESTINOS[destino].agentes];
}
