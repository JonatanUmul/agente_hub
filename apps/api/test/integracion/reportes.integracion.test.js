import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { limpiarCache } from '../../src/modules/reportes/reportes.service.js';
import { crearContexto } from './contexto.js';

// Datos INVENTADOS en enero de 2020 (nada real ni reciente), para que los conteos sean exactos.
// Periodo de la prueba: 2020-01-10 a 2020-01-19 (10 días). El anterior: 2019-12-31 a 2020-01-09.
let ctx;
let lectura;
let comercial;
const p = () => `TEST-${ctx.sufijo}`;
const conv = (n) => `${p()}-C${n}`;
const agenteId = String(9_200_000 + Math.floor(Math.random() * 99_999));
const RANGO = 'desde=2020-01-10&hasta=2020-01-19';

beforeAll(async () => {
  ctx = await crearContexto();
  lectura = await ctx.sesionCon('lectura');
  comercial = await ctx.sesionCon('comercial');
  const a = ctx.poolAdmin;
  await a.query(
    `INSERT INTO hubspot_agentes (id, email, nombre, apellido, bandeja, estado_agente) VALUES ($1, $2, 'Ana', 'Ventas', 'Televentas', 'activo')`,
    [agenteId, `agente-rep-${ctx.sufijo}@prueba.local`],
  );
  // C1: compra → asesor (televentas). C2: compra, solo bot. C3: SAC → asesor. C4: llega por pauta → asesor.
  // C5: en el periodo ANTERIOR (no debe contar en el actual).
  const ev = [
    [
      conv(1),
      '2020-01-10 10:00-06',
      'comprar_ecofiltro',
      'comprar_ecofiltro',
      'SENT',
      'Televentas',
      null,
      '[1]',
      'mensaje privado C1',
    ],
    [
      conv(1),
      '2020-01-10 10:05-06',
      'agente_asignado',
      'asignar_agente',
      'RECEIVED',
      'Televentas',
      null,
      '[]',
      'otro privado',
    ],
    [
      conv(2),
      '2020-01-11 15:00-06',
      'comprar_ecofiltro',
      'comprar_ecofiltro',
      'SENT',
      'sin_bandeja',
      null,
      '[1,2]',
      'privado',
    ],
    [
      conv(3),
      '2020-01-12 09:00-06',
      'atencion_cliente',
      'atencion_cliente',
      'SENT',
      'SAC',
      null,
      '[]',
      'privado',
    ],
    [
      conv(3),
      '2020-01-12 09:30-06',
      'agente_asignado',
      'asignar_agente',
      'RECEIVED',
      'SAC',
      null,
      '[]',
      'privado',
    ],
    [
      conv(4),
      '2020-01-13 11:00-06',
      'pauta',
      '14.Pautas',
      'SENT',
      'Televentas',
      'PT-TEST',
      '[]',
      'privado',
    ],
    [
      conv(4),
      '2020-01-13 11:10-06',
      'agente_asignado',
      'asignar_agente',
      'RECEIVED',
      'Televentas',
      null,
      '[]',
      'privado',
    ],
    [
      conv(5),
      '2020-01-05 10:00-06',
      'comprar_ecofiltro',
      'comprar_ecofiltro',
      'SENT',
      'Televentas',
      null,
      '[]',
      'privado',
    ],
  ];
  for (const [hilo, fecha, etapa, flujo, status, bandeja, opcion, preguntas, mensaje] of ev) {
    await a.query(
      `INSERT INTO eventos (conversationsthreadid, fecha_registro, etapa_descripcion, workflow, status, bandeja,
                            menu_descripcion_opcion, numero_pregunta, message, name, sesionid_cliente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Cliente Inventado', '+50255558745')`,
      [hilo, fecha, etapa, flujo, status, bandeja, opcion, preguntas, mensaje],
    );
  }
  await a.query(
    `INSERT INTO chat_asignados (conversationsthreadid, id_hubspot_agentes, createdby, fecha_registro)
     VALUES ($1, $3, 'x', '2020-01-10 10:05-06'), ($2, $3, 'x', '2020-01-13 11:10-06')`,
    [conv(1), conv(4), agenteId],
  );
  // 3 mensajes de la bandeja: lunes 13-01 a las 11 h (2) y sábado 11-01 a las 15 h (1).
  for (const [i, fecha] of [
    '2020-01-13 11:00-06',
    '2020-01-13 11:20-06',
    '2020-01-11 15:00-06',
  ].entries()) {
    await a.query(
      `INSERT INTO hubspot_webhook_log (event_id, object_id, subscription_type, received_at, payload)
       VALUES ($1, $2, 'conversation.newMessage', $3, '{"texto":"privado"}')`,
      [`${p()}-W${i}`, i < 2 ? conv(4) : conv(2), fecha],
    );
  }
  // C2 recibe aviso de inactividad y se reactiva (RECEIVED 2 h después); C3 recibe oferta y no responde.
  await a.query(
    `INSERT INTO conversation_inactivity_control (control_key, conversationsthreadid, base_event_id, action, sent_at, message) VALUES
       ($1, $3, 1, 'warning', '2020-01-11 16:00-06', '¿Sigues ahí?'),
       ($2, $4, 1, 'warning', '2020-01-12 10:00-06', 'Tenemos una promoción para ti'),
       ($5, $4, 1, 'close',   '2020-01-12 11:00-06', 'Cerrado')`,
    [`${p()}-I1`, `${p()}-I2`, conv(2), conv(3), `${p()}-I3`],
  );
  await a.query(
    `INSERT INTO eventos (conversationsthreadid, fecha_registro, etapa_descripcion, status) VALUES ($1, '2020-01-11 18:00-06', 'comprar_ecofiltro', 'RECEIVED')`,
    [conv(2)],
  );
  await a.query(
    `INSERT INTO agent_hours_notice_control (messageid, conversationsthreadid, notified_at, motivo) VALUES
       ($1, $2, '2020-01-11 20:00-06', 'fuera_de_horario_sabado')`,
    [`${p()}-H1`, conv(2)],
  );
  limpiarCache();
});

afterAll(async () => {
  const a = ctx.poolAdmin;
  const patron = `${p()}%`;
  await a.query(`DELETE FROM eventos WHERE conversationsthreadid LIKE $1`, [patron]);
  await a.query(`DELETE FROM chat_asignados WHERE conversationsthreadid LIKE $1`, [patron]);
  await a.query(`DELETE FROM hubspot_webhook_log WHERE event_id LIKE $1`, [patron]);
  await a.query(`DELETE FROM conversation_inactivity_control WHERE control_key LIKE $1`, [patron]);
  await a.query(`DELETE FROM agent_hours_notice_control WHERE messageid LIKE $1`, [patron]);
  await a.query(`DELETE FROM hubspot_agentes WHERE id = $1`, [agenteId]);
  await ctx?.cerrar();
});

const reporte = async (persona, extra = '') =>
  (await persona.pedir({ url: `/api/reportes?${RANGO}${extra}` })).json();

describe('integración: reportes', () => {
  it('tarjetas del periodo y comparación con el anterior', async () => {
    const { tarjetas: t } = await reporte(lectura);
    expect(t.conversaciones).toEqual({ valor: 4, anterior: 1, variacion: 300 });
    expect(t.transferidas.valor).toBe(3);
    expect(t.porcentajeTransferidas.valor).toBe(75);
    expect(t.soloBot.valor).toBe(1);
    expect(t.mensajesBandeja.valor).toBe(3);
    expect(t.avisosInactividad.valor).toBe(2);
    expect(t.ofertasRecuperacion.valor).toBe(1);
    expect(t.cierresInactividad.valor).toBe(1);
    expect(t.reactivadas.valor).toBe(1);
    expect(t.porcentajeReactivacion.valor).toBe(50);
    expect(t.avisosFueraHorario.valor).toBe(1);
  });

  it('series: por día (con días vacíos), módulos, agentes, pautas, preguntas y mapa de calor', async () => {
    const r = await reporte(lectura);
    expect(r.porDia).toHaveLength(10);
    expect(r.porDia.find((d) => d.dia === '2020-01-13')).toMatchObject({
      conversaciones: 1,
      mensajes: 2,
    });
    expect(r.porDia.find((d) => d.dia === '2020-01-15')).toMatchObject({
      conversaciones: 0,
      mensajes: 0,
    });
    expect(r.porModulo).toEqual(
      expect.arrayContaining([
        { modulo: 'COMPRA', conversaciones: 2 },
        { modulo: 'SAC', conversaciones: 1 },
        { modulo: 'PAUTAS', conversaciones: 1 },
      ]),
    );
    expect(r.porAgente).toEqual([
      expect.objectContaining({ agenteId, agente: 'Ana Ventas', bandeja: 'televentas', chats: 2 }),
    ]);
    expect(r.porPauta).toEqual([
      { codigo: 'PT-TEST', pauta: 'PT-TEST', conversaciones: 1, transferidas: 1 },
    ]);
    expect(r.horasPico).toEqual(
      expect.arrayContaining([
        { diaSemana: 1, hora: 11, mensajes: 2 },
        { diaSemana: 6, hora: 15, mensajes: 1 },
      ]),
    );
  });

  it('filtros: módulo, bandeja y agente', async () => {
    expect((await reporte(lectura, '&modulo=SAC')).tarjetas.conversaciones.valor).toBe(1);
    expect((await reporte(lectura, '&bandeja=TELEVENTAS')).tarjetas.conversaciones.valor).toBe(2);
    const porAgente = await reporte(lectura, `&agente=${agenteId}`);
    expect(porAgente.tarjetas.conversaciones.valor).toBe(2);
    expect(porAgente.tarjetas.mensajesBandeja.valor).toBe(2); // solo los de C4
  });

  it('valida el rango: obligatorio y máximo 365 días', async () => {
    expect((await lectura.pedir({ url: '/api/reportes' })).statusCode).toBe(400);
    expect(
      (await lectura.pedir({ url: '/api/reportes?desde=2019-01-01&hasta=2020-01-19' })).statusCode,
    ).toBe(400);
  });

  it('el detalle no expone datos del cliente', async () => {
    const res = await lectura.pedir({ url: `/api/reportes/detalle?${RANGO}` });
    const filas = res.json().filter((f) => f.conversacion.startsWith(p()));
    expect(filas).toHaveLength(4);
    expect(filas.find((f) => f.conversacion === conv(4))).toMatchObject({
      transferida: true,
      pauta: 'PT-TEST',
    });
    expect(res.body).not.toMatch(/privado|Cliente Inventado|5555/);
  });

  it('exportar CSV: solo admin y comercial; sin datos privados', async () => {
    expect(
      (await lectura.pedir({ url: `/api/reportes/exportar/detalle?${RANGO}` })).statusCode,
    ).toBe(403);
    const res = await comercial.pedir({ url: `/api/reportes/exportar/detalle?${RANGO}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(
      'ecofiltro-detalle-2020-01-10-a-2020-01-19.csv',
    );
    expect(res.body).toContain('Conversación;Inicio;Módulos;Transferida a asesor;Pauta');
    expect(res.body).not.toMatch(/privado|Cliente Inventado|5555/);
  });

  it('el rol de reportes no puede leer mensajes ni escribir', async () => {
    const { crearPoolReportes } = await import('../../src/db/pool.js');
    const { cargarEnv } = await import('../../src/config/env.js');
    const pool = crearPoolReportes(cargarEnv());
    try {
      await expect(pool.query('SELECT message FROM eventos LIMIT 1')).rejects.toThrow(
        /permission denied/,
      );
      await expect(pool.query(`SELECT payload FROM hubspot_webhook_log LIMIT 1`)).rejects.toThrow(
        /permission denied/,
      );
      await expect(pool.query(`DELETE FROM eventos WHERE false`)).rejects.toThrow(
        /read-only|permission denied/,
      );
    } finally {
      await pool.end();
    }
  });
});
