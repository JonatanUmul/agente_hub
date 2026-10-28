import { MODULOS_REPORTE, periodoAnterior, variacion } from '@ecofiltro/shared';
import { AppError } from '../../lib/app-error.js';
import { aCsv } from '../../lib/csv.js';
import * as repo from './reportes.repository.js';

// Caché en memoria: los datos del bot cambian a cada minuto, pero el dashboard no necesita más frescura y así
// varias personas mirando el mismo rango no repiten las consultas. Limitada en tamaño para no crecer sin fin.
const DURACION_CACHE_MS = 5 * 60_000;
const MAXIMO_CACHE = 100;
const cache = new Map();

async function conCache(clave, calcular) {
  const guardado = cache.get(clave);
  if (guardado && guardado.vence > Date.now()) return guardado.valor;
  const valor = await calcular();
  if (cache.size >= MAXIMO_CACHE) cache.delete(cache.keys().next().value); // el más antiguo
  cache.set(clave, { valor, vence: Date.now() + DURACION_CACHE_MS });
  return valor;
}
export const limpiarCache = () => cache.clear();

function verificarConfigurado(db) {
  if (!db) {
    throw new AppError({
      codigo: 'REPORTES_NO_CONFIGURADOS',
      mensaje: 'Los reportes no están configurados (falta el rol de solo lectura eco_reportes).',
      estadoHttp: 503,
    });
  }
}

// Filtros de la API → parámetros de las consultas (el módulo se traduce a su etapa en `eventos`).
const aConsulta = (filtros) => ({
  ...filtros,
  etapa: filtros.modulo ? MODULOS_REPORTE[filtros.modulo] : null,
});

const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);

// Valores de las tarjetas a partir de las consultas de un periodo.
function valoresTarjetas(t, r) {
  return {
    conversaciones: t.conversaciones,
    mensajesBandeja: t.mensajes_bandeja,
    transferidas: t.transferidas,
    porcentajeTransferidas: porcentaje(t.transferidas, t.conversaciones),
    soloBot: t.conversaciones - t.transferidas,
    cambiosModulo: t.cambios_modulo,
    avisosFueraHorario: t.avisos_fuera_horario,
    avisosInactividad: t.avisos_inactividad,
    ofertasRecuperacion: t.ofertas_recuperacion,
    cierresInactividad: t.cierres_inactividad,
    reactivadas: r.reactivadas,
    porcentajeReactivacion: porcentaje(r.reactivadas, r.con_aviso),
  };
}

export function obtenerReporte(db, filtros) {
  verificarConfigurado(db);
  return conCache(`reporte:${JSON.stringify(filtros)}`, async () => {
    const actual = aConsulta(filtros);
    const anterior = { ...actual, ...periodoAnterior(filtros) };

    const [
      tActual,
      tAnterior,
      rActual,
      rAnterior,
      tiempo,
      dias,
      calor,
      modulos,
      agentes,
      fuera,
      pautas,
      preguntas,
      multimedia,
    ] = await Promise.all([
      repo.tarjetas(db, actual),
      repo.tarjetas(db, anterior),
      repo.reactivacion(db, actual),
      repo.reactivacion(db, anterior),
      repo.tiempoAsignacion(db, actual),
      repo.porDia(db, actual),
      repo.horasPico(db, actual),
      repo.porModulo(db, actual),
      repo.porAgente(db, actual),
      repo.fueraDeHorario(db, actual),
      repo.porPauta(db, actual),
      repo.preguntasMasUsadas(db, actual),
      repo.multimediaMasEnviada(db, actual),
    ]);

    const ahora = valoresTarjetas(tActual, rActual);
    const antes = valoresTarjetas(tAnterior, rAnterior);
    const tarjetas = Object.fromEntries(
      Object.keys(ahora).map((k) => [
        k,
        { valor: ahora[k], anterior: antes[k], variacion: variacion(ahora[k], antes[k]) },
      ]),
    );

    return {
      periodo: { desde: filtros.desde, hasta: filtros.hasta },
      periodoAnterior: periodoAnterior(filtros),
      generadoEn: new Date().toISOString(),
      tarjetas,
      tiempoAsignacion: {
        casos: tiempo.casos,
        medianaMin: tiempo.mediana_min,
        p90Min: tiempo.p90_min,
      },
      porDia: dias,
      horasPico: calor.map((c) => ({
        diaSemana: c.dia_semana,
        hora: c.hora,
        mensajes: c.mensajes,
      })),
      porModulo: modulos,
      porAgente: agentes.map((a) => ({
        agenteId: a.agente_id,
        agente: a.agente,
        bandeja: a.bandeja,
        chats: a.chats,
        conversaciones: a.conversaciones,
      })),
      fueraDeHorario: fuera,
      porPauta: pautas,
      preguntas,
      multimedia: multimedia.map((m) => ({
        tipo: m.tipo,
        descripcion: m.descripcion,
        productoCodigo: m.producto_codigo,
        producto: m.producto,
        envios: m.envios,
      })),
    };
  });
}

export function obtenerDetalle(db, filtros) {
  verificarConfigurado(db);
  return conCache(`detalle:${JSON.stringify(filtros)}`, async () =>
    (await repo.detalle(db, aConsulta(filtros))).map((f) => ({
      conversacion: f.conversacion,
      inicio: f.inicio.toISOString(),
      modulos: f.modulos,
      transferida: f.transferida,
      pauta: f.pauta,
    })),
  );
}

// Columnas de cada tabla exportable (los títulos son los que verá quien abra el CSV).
const EXPORTACIONES = {
  'por-dia': {
    filas: async (db, f) => (await obtenerReporte(db, f)).porDia,
    columnas: [
      { titulo: 'Día', valor: (r) => r.dia },
      { titulo: 'Conversaciones del bot', valor: (r) => r.conversaciones },
      { titulo: 'Transferidas a asesor', valor: (r) => r.transferidas },
      { titulo: 'Mensajes de la bandeja', valor: (r) => r.mensajes },
    ],
  },
  agentes: {
    filas: async (db, f) => (await obtenerReporte(db, f)).porAgente,
    columnas: [
      { titulo: 'Agente', valor: (r) => r.agente },
      { titulo: 'Bandeja', valor: (r) => r.bandeja },
      { titulo: 'Chats', valor: (r) => r.chats },
      { titulo: 'Conversaciones', valor: (r) => r.conversaciones },
    ],
  },
  pautas: {
    filas: async (db, f) => (await obtenerReporte(db, f)).porPauta,
    columnas: [
      { titulo: 'Código', valor: (r) => r.codigo },
      { titulo: 'Pauta', valor: (r) => r.pauta },
      { titulo: 'Conversaciones', valor: (r) => r.conversaciones },
      { titulo: 'Transferidas a asesor', valor: (r) => r.transferidas },
    ],
  },
  preguntas: {
    filas: async (db, f) => (await obtenerReporte(db, f)).preguntas,
    columnas: [
      { titulo: 'Número', valor: (r) => r.numero },
      { titulo: 'Pregunta', valor: (r) => r.pregunta },
      { titulo: 'Veces usada', valor: (r) => r.veces },
    ],
  },
  multimedia: {
    filas: async (db, f) => (await obtenerReporte(db, f)).multimedia,
    columnas: [
      { titulo: 'Tipo', valor: (r) => r.tipo },
      { titulo: 'Descripción', valor: (r) => r.descripcion },
      { titulo: 'Producto', valor: (r) => r.producto },
      { titulo: 'ItemCode', valor: (r) => r.productoCodigo },
      { titulo: 'Envíos', valor: (r) => r.envios },
    ],
  },
  detalle: {
    filas: obtenerDetalle,
    columnas: [
      { titulo: 'Conversación', valor: (r) => r.conversacion },
      { titulo: 'Inicio', valor: (r) => r.inicio },
      { titulo: 'Módulos', valor: (r) => r.modulos },
      { titulo: 'Transferida a asesor', valor: (r) => (r.transferida ? 'Sí' : 'No') },
      { titulo: 'Pauta', valor: (r) => r.pauta },
    ],
  },
};

export async function exportarCsv(db, tabla, filtros) {
  const { filas, columnas } = EXPORTACIONES[tabla];
  return aCsv(columnas, await filas(db, filtros));
}
