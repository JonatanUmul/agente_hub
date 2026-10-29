import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loQueRecibeElCliente } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

let ctx;
let comercial;
let lectura;
let pautaId;
const archivo = (n) => `ARTE-${ctx.sufijo}-${n}`;

beforeAll(async () => {
  ctx = await crearContexto();
  comercial = await ctx.sesionCon('comercial');
  lectura = await ctx.sesionCon('lectura');
  const { rows } = await ctx.pool.query(
    `INSERT INTO eco_pautas (codigo, nombre, actualizado_por) VALUES ($1, 'Pauta de prueba', 'test') RETURNING id`,
    [`TEST-${ctx.sufijo}`],
  );
  pautaId = rows[0].id;
});

afterAll(async () => {
  await ctx.poolAdmin.query(`DELETE FROM eco_multimedia WHERE hubspot_file_id LIKE $1`, [
    `ARTE-${ctx.sufijo}-%`,
  ]);
  await ctx.poolAdmin.query(`DELETE FROM eco_pautas WHERE id = $1`, [pautaId]);
  await ctx?.cerrar();
});

const crearArte = (n, reemplaza = null) =>
  comercial.pedir({
    method: 'POST',
    url: '/api/multimedia/arte-pauta',
    payload: { pautaId, hubspotFileId: archivo(n), descripcion: `Arte ${n}`, reemplaza },
  });
const archivos = async () => (await comercial.pedir({ url: '/api/multimedia' })).json();

describe('integración: arte de la pauta', () => {
  let primero;

  it('alta: imagen sin producto con pauta_id = la pauta', async () => {
    const res = await crearArte(1);
    expect(res.statusCode).toBe(201);
    primero = res.json();
    expect(primero).toMatchObject({
      tipo: 'imagen',
      producto: null,
      pautaIdPrincipal: pautaId,
      activo: true,
      actualizadoPor: comercial.correo,
    });
    const { rows } = await ctx.pool.query(
      `SELECT pauta_id, producto_id FROM eco_multimedia WHERE id = $1`,
      [primero.id],
    );
    expect(rows[0]).toEqual({ pauta_id: pautaId, producto_id: null });

    const recibe = loQueRecibeElCliente(await archivos(), pautaId, 1);
    expect(recibe.conArte).toBe(true);
    expect(recibe.imagenes.map((a) => a.id)).toEqual([primero.id]);
  });

  it('reemplazo: desactiva el anterior y el nuevo queda activo en su lugar', async () => {
    const res = await crearArte(2, { id: primero.id, version: primero.version });
    expect(res.statusCode).toBe(201);
    const lista = await archivos();
    expect(lista.find((a) => a.id === primero.id).activo).toBe(false);
    expect(res.json().orden).toBe(primero.orden);
    expect(loQueRecibeElCliente(lista, pautaId, 1).imagenes.map((a) => a.id)).toEqual([
      res.json().id,
    ]);

    // Reemplazar otra vez con la versión vieja del primero: ya cambió.
    expect((await crearArte(3, { id: primero.id, version: primero.version })).statusCode).toBe(409);
  });

  it('desactivación: sin artes activos el cliente ya no recibe arte', async () => {
    const actual = (await archivos()).find((a) => a.hubspotFileId === archivo(2));
    const res = await comercial.pedir({
      method: 'PATCH',
      url: `/api/multimedia/${actual.id}/activo`,
      payload: { activo: false, version: actual.version },
    });
    expect(res.json().activo).toBe(false);
    expect(loQueRecibeElCliente(await archivos(), pautaId, 1).conArte).toBe(false);
  });

  it('el rol lectura no puede subir artes', async () => {
    const res = await lectura.pedir({
      method: 'POST',
      url: '/api/multimedia/arte-pauta',
      payload: { pautaId, hubspotFileId: archivo(9), descripcion: 'x', reemplaza: null },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('integración: parámetros enteros', () => {
  const leer = async (clave) =>
    (await comercial.pedir({ url: '/api/configuracion/parametros' }))
      .json()
      .find((p) => p.clave === clave);
  const guardar = (clave, valor, version) =>
    comercial.pedir({
      method: 'PUT',
      url: `/api/configuracion/parametros/${clave}`,
      payload: { valor, version },
    });

  it('valida el rango y guarda como texto con el correo', async () => {
    const original = await leer('segundos_agrupar_mensajes');
    try {
      expect((await guardar('segundos_agrupar_mensajes', 21, original.version)).statusCode).toBe(
        400,
      );
      const res = await guardar('segundos_agrupar_mensajes', 0, original.version);
      expect(res.json()).toMatchObject({ valor: 0, actualizadoPor: comercial.correo });
      const { rows } = await ctx.pool.query(
        `SELECT valor FROM eco_configuracion WHERE clave = 'segundos_agrupar_mensajes'`,
      );
      expect(rows[0].valor).toBe('0');
    } finally {
      const ahora = await leer('segundos_agrupar_mensajes');
      await guardar('segundos_agrupar_mensajes', original.valor, ahora.version);
    }
  });

  it('max_fotos_pauta rechaza decimales', async () => {
    const actual = await leer('max_fotos_pauta');
    expect((await guardar('max_fotos_pauta', 1.5, actual.version)).statusCode).toBe(400);
  });
});
