import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { limpiarCache } from '../../src/modules/reportes/reportes.service.js';
import { crearContexto } from './contexto.js';

// Datos INVENTADOS en marzo de 2020, para que los conteos sean exactos.
let ctx;
let comercial;
const conv = (n) => `TEST-${ctx.sufijo}-IA${n}`;
const RANGO = 'desde=2020-03-01&hasta=2020-03-31';

beforeAll(async () => {
  ctx = await crearContexto();
  comercial = await ctx.sesionCon('comercial');
  const a = ctx.poolAdmin;
  // IA1: seguimiento y el cliente responde. IA2: seguimiento sin respuesta. IA3: la IA cerró sin mensaje.
  await a.query(
    `INSERT INTO conversation_inactivity_control (control_key, conversationsthreadid, base_event_id, action, sent_at, message) VALUES
       ($1, $4, 0, 'seguimiento_ia', '2020-03-10 10:00-06', '¿Te quedó alguna duda?'),
       ($2, $5, 0, 'seguimiento_ia', '2020-03-11 10:00-06', '¿Te ayudo con tu pedido?'),
       ($3, $6, 0, 'cierre_ia', '2020-03-12 10:00-06', 'cerrar: se despidió')`,
    [`${conv(1)}-c`, `${conv(2)}-c`, `${conv(3)}-c`, conv(1), conv(2), conv(3)],
  );
  await a.query(
    `INSERT INTO eventos (conversationsthreadid, fecha_registro, status, message) VALUES
       ($1, '2020-03-10 10:05-06', 'RECEIVED', 'privado'),
       ($2, '2020-03-11 09:00-06', 'RECEIVED', 'antes del seguimiento')`,
    [conv(1), conv(2)],
  );
  limpiarCache();
});

afterAll(async () => {
  await ctx.poolAdmin.query(
    `DELETE FROM conversation_inactivity_control WHERE conversationsthreadid LIKE $1`,
    [`TEST-${ctx.sufijo}-IA%`],
  );
  await ctx.poolAdmin.query(`DELETE FROM eventos WHERE conversationsthreadid LIKE $1`, [
    `TEST-${ctx.sufijo}-IA%`,
  ]);
  await ctx?.cerrar();
});

const pedir = async (query = '') =>
  (await comercial.pedir({ url: `/api/reportes/seguimientos-ia?${RANGO}${query}` })).json();

describe('integración: seguimientos de la IA', () => {
  it('lista decisiones, marca si el cliente respondió después y no expone sus mensajes', async () => {
    const filas = (await pedir()).filter((f) => f.conversacion.startsWith(`TEST-${ctx.sufijo}`));
    expect(filas.map((f) => [f.conversacion, f.decision, f.respondio])).toEqual([
      [conv(3), 'cerrado', false],
      [conv(2), 'enviado', false],
      [conv(1), 'enviado', true],
    ]);
    expect(JSON.stringify(filas)).not.toContain('privado');
  });

  it('filtra por decisión', async () => {
    const cerrados = (await pedir('&decision=cerrado')).filter((f) =>
      f.conversacion.startsWith(`TEST-${ctx.sufijo}`),
    );
    expect(cerrados.map((f) => f.conversacion)).toEqual([conv(3)]);
  });
});

describe('integración: interruptor seguimiento_ia_activo', () => {
  it('se puede encender y apagar', async () => {
    const leer = async () =>
      (await comercial.pedir({ url: '/api/configuracion/interruptores' }))
        .json()
        .find((i) => i.clave === 'seguimiento_ia_activo');
    const original = await leer();
    try {
      const res = await comercial.pedir({
        method: 'PUT',
        url: '/api/configuracion/interruptores/seguimiento_ia_activo',
        payload: { habilitado: !original.habilitado },
      });
      expect(res.json().habilitado).toBe(!original.habilitado);
    } finally {
      await comercial.pedir({
        method: 'PUT',
        url: '/api/configuracion/interruptores/seguimiento_ia_activo',
        payload: { habilitado: original.habilitado },
      });
    }
  });
});
