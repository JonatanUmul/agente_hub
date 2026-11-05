import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAMPOS_FICHA, CAMPOS_VISION } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

// Identificación por imagen: pistas y fotos de referencia del producto, vision_activa y vision_modelo.
let ctx;
let comercial;
const ids = {};
const prefijo = () => `VIS-${ctx.sufijo}`;

beforeAll(async () => {
  ctx = await crearContexto();
  comercial = await ctx.sesionCon('comercial');
  for (const tipo of ['equipo', 'accesorio']) {
    const { rows } = await ctx.pool.query(
      `INSERT INTO eco_productos (codigo, nombre, tipo, familia, actualizado_por)
       VALUES ($1, $1, $2, 'prueba', 'test') RETURNING id`,
      [`${prefijo()}-${tipo}`, tipo],
    );
    ids[tipo] = rows[0].id;
  }
});

afterAll(async () => {
  await ctx.poolAdmin.query(`DELETE FROM eco_productos WHERE codigo LIKE $1`, [`${prefijo()}%`]);
  await ctx.poolAdmin.query(
    `DELETE FROM eco_auditoria WHERE tabla = 'eco_productos' AND registro_id = ANY($1::text[])`,
    [Object.values(ids).map(String)],
  );
  await ctx?.cerrar();
});

const obtener = async (id) => (await comercial.pedir({ url: `/api/productos/${id}` })).json();
const guardar = async (id, cambios) => {
  const p = await obtener(id);
  return comercial.pedir({
    method: 'PUT',
    url: `/api/productos/${id}`,
    payload: {
      precioBase: p.precioBase,
      descuentoPct: p.descuentoPct,
      estado: p.estado,
      colores: p.colores,
      palabrasClave: p.palabrasClave,
      pautaIds: p.pautas.map((pa) => pa.id),
      orden: p.orden,
      activo: p.activo,
      ...Object.fromEntries([...CAMPOS_FICHA, ...CAMPOS_VISION].map((c) => [c, p[c]])),
      version: p.version,
      ...cambios,
    },
  });
};

describe('integración: identificación por imagen', () => {
  it('guarda pistas y fotos en eco_productos (jsonb) con auditoría', async () => {
    const fotos = [
      { url: 'https://cdn.ejemplo.com/azul.jpg', color: 'Azul' },
      { url: 'https://cdn.ejemplo.com/rojo.jpg', color: null },
    ];
    const res = await guardar(ids.equipo, {
      pistasVisuales: 'Base tipo campana',
      fotosReferencia: fotos,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      pistasVisuales: 'Base tipo campana',
      fotosReferencia: fotos,
    });

    const { rows } = await ctx.pool.query(
      `SELECT pistas_visuales, fotos_referencia FROM eco_productos WHERE id = $1`,
      [ids.equipo],
    );
    expect(rows[0].fotos_referencia).toEqual(fotos);
    const { rows: auditoria } = await ctx.poolAdmin.query(
      `SELECT count(*)::int AS n FROM eco_auditoria
       WHERE tabla = 'eco_productos' AND registro_id = $1 AND operacion = 'UPDATE'`,
      [String(ids.equipo)],
    );
    expect(auditoria[0].n).toBe(1);

    // Guardar sin cambios no escribe.
    expect((await guardar(ids.equipo, {})).json().version).toBe(res.json().version);
  });

  it('rechaza URL sin https, más de 6 fotos y pistas en un accesorio', async () => {
    const http = await guardar(ids.equipo, {
      fotosReferencia: [{ url: 'http://cdn.ejemplo.com/a.jpg', color: null }],
    });
    expect(http.statusCode).toBe(400);
    const muchas = Array.from({ length: 7 }, (_, i) => ({
      url: `https://x.com/${i}.jpg`,
      color: null,
    }));
    expect((await guardar(ids.equipo, { fotosReferencia: muchas })).statusCode).toBe(400);
    const accesorio = await guardar(ids.accesorio, { pistasVisuales: 'Tapa azul' });
    expect(accesorio.statusCode).toBe(400);
    expect(accesorio.json().error.codigo).toBe('CAMPO_NO_APLICA');
  });

  it('vision_activa y vision_modelo se editan desde la app', async () => {
    const interruptor = await comercial.pedir({
      method: 'PUT',
      url: '/api/configuracion/interruptores/vision_activa',
      payload: { habilitado: false },
    });
    expect(interruptor.statusCode).toBe(200);

    const [modelo] = (await comercial.pedir({ url: '/api/configuracion/textos' })).json();
    expect(modelo.clave).toBe('vision_modelo');
    const cambiar = (valor, version = modelo.version) =>
      comercial.pedir({
        method: 'PUT',
        url: '/api/configuracion/textos/vision_modelo',
        payload: { valor, version },
      });
    expect((await cambiar('gemini')).statusCode).toBe(400);
    const otro = await cambiar('openai/gpt-4o');
    expect(otro.json()).toMatchObject({ valor: 'openai/gpt-4o', actualizadoPor: comercial.correo });
    expect((await cambiar('google/gemini-2.5-pro')).statusCode).toBe(409); // versión vieja
    await cambiar(modelo.valor, otro.json().version);
  });
});
