import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MODULOS, contextosDeRegla } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

let ctx;
let contenido;
let comercial;
const reglaIds = [];
let preguntaNumero;
const prefijo = () => `TEST-${ctx.sufijo}`;
const horas = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

beforeAll(async () => {
  ctx = await crearContexto();
  contenido = await ctx.sesionCon('contenido');
  comercial = await ctx.sesionCon('comercial');
});

afterAll(async () => {
  const admin = ctx.poolAdmin;
  await admin.query(`DELETE FROM eco_reglas_bot WHERE codigo LIKE $1`, [`${prefijo()}%`]);
  await admin.query(
    `DELETE FROM eco_auditoria WHERE tabla = 'eco_reglas_bot' AND registro_id = ANY($1::text[])`,
    [reglaIds.map(String)],
  );
  if (preguntaNumero) {
    await admin.query(`DELETE FROM eco_preguntas_frecuentes WHERE numero = $1`, [preguntaNumero]);
    await admin.query(
      `DELETE FROM eco_auditoria WHERE tabla = 'eco_preguntas_frecuentes' AND registro_id = $1`,
      [String(preguntaNumero)],
    );
  }
  await ctx?.cerrar();
});

const crearRegla = (sufijo, cambios = {}) =>
  contenido.pedir({
    method: 'POST',
    url: '/api/reglas',
    payload: {
      codigo: `${prefijo()}-${sufijo}`,
      modulo: 'GLOBAL',
      destino: 'TODOS',
      categoria: 'prueba',
      titulo: `Regla ${sufijo}`,
      regla: `Texto de la regla ${sufijo}`,
      prioridad: 50,
      activo: true,
      vigenteDesde: null,
      vigenteHasta: null,
      ...cambios,
    },
  });

describe('integración: reglas', () => {
  it('contenido crea reglas; comercial no puede', async () => {
    for (const [sufijo, cambios] of [
      ['global', {}],
      ['sac', { modulo: 'SAC', destino: 'REDACTOR' }],
      ['compra', { modulo: 'COMPRA' }],
      ['programada', { modulo: 'SAC', vigenteDesde: horas(24) }],
      ['vencida', { modulo: 'SAC', vigenteDesde: horas(-48), vigenteHasta: horas(-24) }],
      ['inactiva', { modulo: 'SAC', activo: false }],
    ]) {
      const res = await crearRegla(sufijo, cambios);
      expect(res.statusCode).toBe(201);
      reglaIds.push(res.json().id);
    }
    expect((await crearRegla('global')).statusCode).toBe(409);
    expect(
      (await comercial.pedir({ method: 'POST', url: '/api/reglas', payload: {} })).statusCode,
    ).toBe(403);
  });

  it('calcula el estado de vigencia', async () => {
    const reglas = (await contenido.pedir({ url: '/api/reglas' })).json();
    const estado = (s) => reglas.find((r) => r.codigo === `${prefijo()}-${s}`).estadoVigencia;
    expect([estado('global'), estado('programada'), estado('vencida'), estado('inactiva')]).toEqual(
      ['vigente', 'programada', 'vencida', 'inactiva'],
    );
  });

  it('contextosDeRegla() coincide con eco_contexto() en cada módulo', async () => {
    const reglas = (await contenido.pedir({ url: '/api/reglas' }))
      .json()
      .filter((r) => r.codigo.startsWith(prefijo()));
    for (const modulo of MODULOS) {
      const { rows } = await ctx.pool.query(`SELECT eco_contexto($1) AS c`, [modulo]);
      const enContexto = new Set(rows[0].c.reglas.map((r) => r.codigo));
      for (const regla of reglas) {
        expect([modulo, regla.codigo, enContexto.has(regla.codigo)]).toEqual([
          modulo,
          regla.codigo,
          contextosDeRegla(regla).includes(modulo),
        ]);
      }
    }
  });

  it('desactivar una regla la quita del contexto y queda auditado quién lo hizo', async () => {
    const id = reglaIds[1]; // SAC
    const actual = (await contenido.pedir({ url: `/api/reglas/${id}` })).json();
    const res = await contenido.pedir({
      method: 'PATCH',
      url: `/api/reglas/${id}/activo`,
      payload: { activo: false, version: actual.version },
    });
    expect(res.json()).toMatchObject({ activo: false, actualizadoPor: contenido.correo });
    const { rows } = await ctx.pool.query(`SELECT eco_contexto('SAC') AS c`);
    expect(rows[0].c.reglas.map((r) => r.codigo)).not.toContain(actual.codigo);
  });
});

describe('integración: destinos nuevos', () => {
  it('acepta SELECTOR, ORQUESTADOR (GLOBAL) y VISION; rechaza ORQUESTADOR en un módulo', async () => {
    for (const [sufijo, cambios] of [
      ['selector', { destino: 'SELECTOR', modulo: 'SAC' }],
      ['orquestador', { destino: 'ORQUESTADOR', modulo: 'GLOBAL' }],
      ['vision', { destino: 'VISION' }],
    ]) {
      const res = await crearRegla(sufijo, cambios);
      expect(res.statusCode).toBe(201);
      reglaIds.push(res.json().id);
    }
    const mal = await crearRegla('orq-sac', { destino: 'ORQUESTADOR', modulo: 'SAC' });
    expect(mal.statusCode).toBe(400);
    expect(mal.json().error.detalles[0].campo).toBe('modulo');
  });
});

describe('integración: preguntas frecuentes', () => {
  it('crea con el número sugerido y aparece en la vista del bot', async () => {
    const { numero } = (await contenido.pedir({ url: '/api/preguntas/siguiente-numero' })).json();
    preguntaNumero = numero;
    const payload = {
      numero,
      pregunta: `¿Pregunta de prueba ${prefijo()}?`,
      tema: null,
      palabrasClave: ['prueba'],
      respuesta: 'Respuesta de prueba',
      modulos: ['SAC', 'COMPRA'],
      orden: 100,
      activo: true,
    };
    const res = await contenido.pedir({ method: 'POST', url: '/api/preguntas', payload });
    expect(res.statusCode).toBe(201);
    expect(
      (await contenido.pedir({ method: 'POST', url: '/api/preguntas', payload })).statusCode,
    ).toBe(409);

    const { rows } = await ctx.pool.query(
      `SELECT modulos FROM eco_v_preguntas_frecuentes WHERE numero = $1`,
      [numero],
    );
    expect(rows[0].modulos).toEqual(['SAC', 'COMPRA']);
  });

  it('desactivarla la quita de la vista; la auditoría la identifica por número', async () => {
    const lista = (await contenido.pedir({ url: '/api/preguntas' })).json();
    const pregunta = lista.find((p) => p.numero === preguntaNumero);
    await contenido.pedir({
      method: 'PATCH',
      url: `/api/preguntas/${pregunta.id}/activo`,
      payload: { activo: false, version: pregunta.version },
    });
    const vista = await ctx.pool.query(
      `SELECT 1 FROM eco_v_preguntas_frecuentes WHERE numero = $1`,
      [preguntaNumero],
    );
    expect(vista.rowCount).toBe(0);
    const auditoria = await ctx.pool.query(
      `SELECT operacion FROM eco_auditoria WHERE tabla = 'eco_preguntas_frecuentes' AND registro_id = $1 ORDER BY id`,
      [String(preguntaNumero)],
    );
    expect(auditoria.rows.map((r) => r.operacion)).toEqual(['INSERT', 'UPDATE']);
  });
});
