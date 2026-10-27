import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearContexto } from './contexto.js';

// Agente ficticio propio de esta prueba (en producción los crea n8n).
let ctx;
let admin;
let comercial;
const agenteId = 9_100_000 + Math.floor(Math.random() * 99_999);

const semana = (rangosPorDia) =>
  [1, 2, 3, 4, 5, 6, 7].map((diaSemana) => ({ diaSemana, rangos: rangosPorDia(diaSemana) }));
const todoElDia = () => [{ horaInicio: '00:00', horaFin: '23:59' }];

beforeAll(async () => {
  ctx = await crearContexto();
  admin = await ctx.sesionCon('admin');
  comercial = await ctx.sesionCon('comercial');
  await ctx.poolAdmin.query(
    `INSERT INTO hubspot_agentes (id, email, nombre, bandeja, estado_agente) VALUES ($1, $2, 'Prueba', 'SAC', 'activo')`,
    [agenteId, `agente-${ctx.sufijo}@prueba.local`],
  );
});

afterAll(async () => {
  const a = ctx.poolAdmin;
  await a.query(`DELETE FROM eco_agentes_horario WHERE agente_id = $1`, [agenteId]);
  await a.query(`DELETE FROM eco_agentes_descanso WHERE agente_id = $1`, [agenteId]);
  await a.query(`DELETE FROM hubspot_agentes WHERE id = $1`, [agenteId]);
  await a.query(`DELETE FROM eco_auditoria WHERE tabla LIKE 'eco_agentes_%' AND registro_id = $1`, [
    String(agenteId),
  ]);
  await ctx?.cerrar();
});

const agente = async () =>
  (await admin.pedir({ url: '/api/agentes' })).json().find((a) => a.id === agenteId);
const guardar = async (dias, version) =>
  admin.pedir({
    method: 'PUT',
    url: `/api/agentes/${agenteId}/horario`,
    payload: { dias, version },
  });

describe('integración: horarios de agentes', () => {
  it('lista el agente sin horario (descansa toda la semana, fuera de horario)', async () => {
    const a = await agente();
    expect(a).toMatchObject({ enHorarioAhora: false, version: '0-0' });
    expect(a.horario.every((d) => d.rangos.length === 0)).toBe(true);
  });

  it('con horario todo el día, todos los días, está en horario ahora; 23:59 se guarda como 24:00', async () => {
    const res = await guardar(semana(todoElDia), (await agente()).version);
    expect(res.statusCode).toBe(204);
    const a = await agente();
    expect(a.enHorarioAhora).toBe(true);
    expect(a.horario[0].rangos).toEqual([{ horaInicio: '00:00', horaFin: '24:00' }]);

    const { rows } = await ctx.pool.query(`SELECT eco_agente_en_horario($1) AS en`, [agenteId]);
    expect(rows[0].en).toBe(true);
  });

  it('rechaza con 409 un guardado basado en una versión vieja', async () => {
    const vieja = (await agente()).version;
    await guardar(
      semana((d) => (d <= 5 ? todoElDia() : [])),
      vieja,
    );
    expect((await guardar(semana(todoElDia), vieja)).statusCode).toBe(409);
  });

  it('un descanso hoy lo saca de horario; al quitarlo vuelve', async () => {
    await guardar(semana(todoElDia), (await agente()).version);
    const { rows } = await ctx.pool.query(
      `SELECT (now() AT TIME ZONE 'America/Guatemala')::date::text AS hoy`,
    );
    const hoy = rows[0].hoy;

    const res = await admin.pedir({
      method: 'POST',
      url: `/api/agentes/${agenteId}/descansos`,
      payload: { desde: hoy, hasta: hoy, motivo: 'Prueba' },
    });
    expect(res.statusCode).toBe(201);
    expect((await agente()).enHorarioAhora).toBe(false);

    await admin.pedir({
      method: 'DELETE',
      url: `/api/agentes/${agenteId}/descansos/${res.json().id}`,
    });
    expect((await agente()).enHorarioAhora).toBe(true);
  });

  it('el bot ve al agente en eco_v_agentes_en_horario', async () => {
    const { rowCount } = await ctx.pool.query(
      `SELECT 1 FROM eco_v_agentes_en_horario WHERE id = $1`,
      [agenteId],
    );
    expect(rowCount).toBe(1);
  });

  it('cada cambio queda en el historial y solo admin puede editar horarios', async () => {
    const { rows } = await ctx.pool.query(
      `SELECT count(*)::int AS n FROM eco_auditoria WHERE tabla = 'eco_agentes_horario' AND registro_id = $1`,
      [String(agenteId)],
    );
    expect(rows[0].n).toBeGreaterThan(0);
    const res = await comercial.pedir({
      method: 'PUT',
      url: `/api/agentes/${agenteId}/horario`,
      payload: { dias: semana(() => []), version: 'x' },
    });
    expect(res.statusCode).toBe(403);
  });
});
