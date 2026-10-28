import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { frasesParaElBot } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

let ctx;
let contenido;
let comercial;
const ids = [];
const texto = (n) => `¿Prueba ${ctx.sufijo} ${n}? 😊`;

beforeAll(async () => {
  ctx = await crearContexto();
  contenido = await ctx.sesionCon('contenido');
  comercial = await ctx.sesionCon('comercial');
});

afterAll(async () => {
  await ctx.poolAdmin.query(`DELETE FROM eco_frases_cierre WHERE frase LIKE $1`, [
    `%${ctx.sufijo}%`,
  ]);
  await ctx.poolAdmin.query(
    `DELETE FROM eco_auditoria WHERE tabla = 'eco_frases_cierre' AND registro_id = ANY($1::text[])`,
    [ids.map(String)],
  );
  await ctx?.cerrar();
});

const crear = (frase, extra = {}) =>
  contenido.pedir({
    method: 'POST',
    url: '/api/frases-cierre',
    payload: { modulo: 'SAC', situacion: 'problema', frase, activo: true, ...extra },
  });
const obtener = async (id) =>
  (await contenido.pedir({ url: '/api/frases-cierre' })).json().find((f) => f.id === id);

describe('integración: frases de cierre', () => {
  it('crea al final del grupo y registra el correo en la auditoría', async () => {
    const a = await crear(texto(1));
    const b = await crear(texto(2));
    expect(a.statusCode).toBe(201);
    ids.push(a.json().id, b.json().id);
    expect(b.json().orden).toBeGreaterThan(a.json().orden);
    expect(a.json()).toMatchObject({ actualizadoPor: contenido.correo, frase: texto(1) });

    const { rows } = await ctx.pool.query(
      `SELECT despues->>'actualizado_por' AS por FROM eco_auditoria
       WHERE tabla = 'eco_frases_cierre' AND registro_id = $1 AND operacion = 'INSERT'`,
      [String(a.json().id)],
    );
    expect(rows[0].por).toBe(contenido.correo);
  });

  it('una frase repetida en el mismo grupo responde 409 (en otro grupo sí se permite)', async () => {
    const repetida = await crear(texto(1));
    expect(repetida.statusCode).toBe(409);
    expect(repetida.json().error.codigo).toBe('FRASE_REPETIDA');
    const otroGrupo = await crear(texto(1), { modulo: 'COMPRA' });
    expect(otroGrupo.statusCode).toBe(201);
    ids.push(otroGrupo.json().id);
  });

  it('valida largo y Markdown en el servidor', async () => {
    expect((await crear('Ok')).statusCode).toBe(400);
    expect((await crear(`**${texto(9)}**`)).statusCode).toBe(400);
  });

  it('desactivar saca la frase de eco_contexto() y la vista previa coincide con la función', async () => {
    const [id] = ids;
    const actual = await obtener(id);
    const res = await contenido.pedir({
      method: 'PATCH',
      url: `/api/frases-cierre/${id}/activo`,
      payload: { activo: false, version: actual.version },
    });
    expect(res.json().activo).toBe(false);

    const { rows } = await ctx.pool.query(`SELECT eco_contexto('SAC')->'frases_cierre' AS f`);
    const enElBot = rows[0].f.map((f) => f.frase);
    expect(enElBot).not.toContain(texto(1));
    expect(enElBot).toContain(texto(2));

    // Lo que la web dice que recibe el bot de SAC = lo que entrega la función (mismo orden).
    const todas = (await contenido.pedir({ url: '/api/frases-cierre' })).json();
    const previa = ['general', 'producto', 'problema'].flatMap((s) =>
      frasesParaElBot(todas, 'SAC', s).filter((f) => f.situacion === s),
    );
    expect(new Set(previa.map((f) => f.frase))).toEqual(new Set(enElBot));
    const ordenFuncion = rows[0].f.filter((f) => f.situacion === 'problema').map((f) => f.frase);
    expect(frasesParaElBot(todas, 'SAC', 'problema').map((f) => f.frase)).toEqual(ordenFuncion);
  });

  it('reordena un grupo y rechaza mezclar grupos', async () => {
    const [a, b, otro] = ids;
    const res = await contenido.pedir({
      method: 'PUT',
      url: '/api/frases-cierre/orden',
      payload: [
        { id: b, orden: 1 },
        { id: a, orden: 2 },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect((await obtener(b)).orden).toBe(1);

    const mezcla = await contenido.pedir({
      method: 'PUT',
      url: '/api/frases-cierre/orden',
      payload: [
        { id: a, orden: 1 },
        { id: otro, orden: 2 },
      ],
    });
    expect(mezcla.statusCode).toBe(400);
  });

  it('borra con la versión vigente y atribuye el borrado a quien lo hizo', async () => {
    const id = ids[2];
    const actual = await obtener(id);
    const vieja = await contenido.pedir({
      method: 'DELETE',
      url: `/api/frases-cierre/${id}?version=vieja`,
    });
    expect(vieja.statusCode).toBe(409);
    const res = await contenido.pedir({
      method: 'DELETE',
      url: `/api/frases-cierre/${id}?version=${encodeURIComponent(actual.version)}`,
    });
    expect(res.statusCode).toBe(204);
    const { rows } = await ctx.pool.query(
      `SELECT antes->>'actualizado_por' AS por FROM eco_auditoria
       WHERE tabla = 'eco_frases_cierre' AND registro_id = $1 AND operacion = 'DELETE'`,
      [String(id)],
    );
    expect(rows[0].por).toBe(contenido.correo);
  });

  it('el interruptor cierre_automatico lo cambia contenido, no comercial', async () => {
    const pedir = (persona, habilitado) =>
      persona.pedir({
        method: 'PUT',
        url: '/api/frases-cierre/cierre-automatico',
        payload: { habilitado },
      });
    expect((await pedir(comercial, false)).statusCode).toBe(403);
    const res = await pedir(contenido, false);
    expect(res.json()).toMatchObject({ clave: 'cierre_automatico', habilitado: false });
    await pedir(contenido, true);
  });
});
