import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mensajesParaElBot } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

let ctx;
let contenido;
let comercial;
const ids = [];
const texto = (n) => `Prueba ${ctx.sufijo} ${n}`;

beforeAll(async () => {
  ctx = await crearContexto();
  contenido = await ctx.sesionCon('contenido');
  comercial = await ctx.sesionCon('comercial');
});

afterAll(async () => {
  await ctx.poolAdmin.query(`DELETE FROM eco_mensajes WHERE texto LIKE $1`, [`%${ctx.sufijo}%`]);
  await ctx.poolAdmin.query(
    `DELETE FROM eco_auditoria WHERE tabla = 'eco_mensajes' AND registro_id = ANY($1::text[])`,
    [ids.map(String)],
  );
  await ctx?.cerrar();
});

const catalogo = async () => (await contenido.pedir({ url: '/api/mensajes' })).json();
const version = async (id) =>
  (await catalogo()).flatMap((t) => t.versiones).find((v) => v.id === id);
const crear = (clave, t, activo = true) =>
  contenido.pedir({ method: 'POST', url: '/api/mensajes', payload: { clave, texto: t, activo } });

describe('integración: mensajes del bot', () => {
  it('crea versiones al final de la clave, con comodines del tipo', async () => {
    const a = await crear('inactividad_aviso', `${texto(1)} en {minutos} minutos`);
    const b = await crear('inactividad_aviso', texto(2));
    expect(a.statusCode).toBe(201);
    ids.push(a.json().id, b.json().id);
    expect(b.json().orden).toBeGreaterThan(a.json().orden);
    expect(a.json().actualizadoPor).toBe(contenido.correo);
  });

  it('rechaza comodines ajenos, Markdown y texto repetido', async () => {
    expect((await crear('inactividad_aviso', `${texto(3)} {nombre}`)).statusCode).toBe(400);
    expect((await crear('inactividad_cierre', `**${texto(3)}**`)).statusCode).toBe(400);
    expect((await crear('inactividad_cierre', `*${texto(3)}*`)).statusCode).toBe(400);
    expect((await crear('pauta_cierre_uno', `*${texto(3)}*`)).statusCode).toBe(201);
    ids.push(
      (await catalogo()).flatMap((t) => t.versiones).find((v) => v.texto === `*${texto(3)}*`).id,
    );
    const repetido = await crear('inactividad_aviso', texto(2));
    expect(repetido.statusCode).toBe(409);
    expect(repetido.json().error.codigo).toBe('TEXTO_REPETIDO');
  });

  it('eco_contexto() entrega los textos activos por clave, en el mismo orden que la app', async () => {
    const { rows } = await ctx.pool.query(`SELECT eco_contexto('SAC')->'mensajes' AS m`);
    expect(rows[0].m).toEqual(mensajesParaElBot(await catalogo()));
  });

  it('reordena dentro de la clave y edita el texto', async () => {
    const [a, b] = ids;
    const res = await contenido.pedir({
      method: 'PUT',
      url: '/api/mensajes/orden',
      payload: [
        { id: b, orden: 1 },
        { id: a, orden: 2 },
      ],
    });
    expect(res.statusCode).toBe(200);
    const actual = await version(b);
    const editado = await contenido.pedir({
      method: 'PUT',
      url: `/api/mensajes/${b}`,
      payload: { texto: texto(4), activo: true, version: actual.version },
    });
    expect(editado.json()).toMatchObject({ texto: texto(4), orden: 1 });
  });

  it('la última versión activa de un mensaje protegido pide confirmar', async () => {
    const tipo = (await catalogo()).find((t) => t.clave === 'inactividad_cierre');
    const activas = tipo.versiones.filter((v) => v.activo);
    // Se deja una sola activa de inactividad_cierre creando una propia y desactivando las demás con confirmar.
    const propia = await crear('inactividad_cierre', texto(5));
    ids.push(propia.json().id);
    const restaurar = [];
    try {
      for (const v of activas) {
        const r = await contenido.pedir({
          method: 'PATCH',
          url: `/api/mensajes/${v.id}/activo`,
          payload: { activo: false, version: v.version },
        });
        expect(r.statusCode).toBe(200);
        restaurar.push(v.id);
      }
      const ultima = await version(propia.json().id);
      const sinConfirmar = await contenido.pedir({
        method: 'DELETE',
        url: `/api/mensajes/${ultima.id}?version=${encodeURIComponent(ultima.version)}`,
      });
      expect(sinConfirmar.statusCode).toBe(409);
      expect(sinConfirmar.json().error.codigo).toBe('ULTIMA_VERSION');
      const confirmado = await contenido.pedir({
        method: 'DELETE',
        url: `/api/mensajes/${ultima.id}?version=${encodeURIComponent(ultima.version)}&confirmar=true`,
      });
      expect(confirmado.statusCode).toBe(204);
    } finally {
      for (const id of restaurar) {
        const v = await version(id);
        await contenido.pedir({
          method: 'PATCH',
          url: `/api/mensajes/${id}/activo`,
          payload: { activo: true, version: v.version },
        });
      }
    }
  });
});

describe('integración: tiempos', () => {
  const leer = async () =>
    Object.fromEntries(
      (await contenido.pedir({ url: '/api/configuracion/parametros' }))
        .json()
        .map((p) => [p.clave, p]),
    );

  it('el cierre por inactividad debe ser mayor que el aviso', async () => {
    const p = await leer();
    const res = await comercial.pedir({
      method: 'PUT',
      url: '/api/configuracion/parametros/minutos_cierre_inactividad',
      payload: {
        valor: p.minutos_aviso_inactividad.valor,
        version: p.minutos_cierre_inactividad.version,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.mensaje).toContain('mayor que el aviso');
  });

  it('recuperacion_compra_activa es un interruptor que se puede cambiar', async () => {
    const leerInterruptor = async () =>
      (await comercial.pedir({ url: '/api/configuracion/interruptores' }))
        .json()
        .find((i) => i.clave === 'recuperacion_compra_activa');
    const original = await leerInterruptor();
    try {
      const res = await comercial.pedir({
        method: 'PUT',
        url: '/api/configuracion/interruptores/recuperacion_compra_activa',
        payload: { habilitado: !original.habilitado },
      });
      expect(res.json().habilitado).toBe(!original.habilitado);
    } finally {
      await comercial.pedir({
        method: 'PUT',
        url: '/api/configuracion/interruptores/recuperacion_compra_activa',
        payload: { habilitado: original.habilitado },
      });
    }
  });
});
