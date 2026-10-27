import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comoLoVeElBot } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

let ctx;
let comercial;
let lectura;
let pauta;
let productoId;
const ids = { archivos: [] };
const codigo = () => `TEST-${ctx.sufijo}`;
const enUnaHora = () => new Date(Date.now() + 3_600_000).toISOString();
const haceUnaHora = () => new Date(Date.now() - 3_600_000).toISOString();

beforeAll(async () => {
  ctx = await crearContexto();
  comercial = await ctx.sesionCon('comercial');
  lectura = await ctx.sesionCon('lectura');
});

afterAll(async () => {
  // eco_app no puede borrar: limpiamos con el superusuario del contenedor de desarrollo.
  const admin = ctx.poolAdmin;
  await admin.query(`DELETE FROM eco_multimedia WHERE hubspot_file_id LIKE $1`, [`${codigo()}%`]);
  await admin.query(`DELETE FROM eco_productos WHERE codigo = $1`, [codigo()]);
  await admin.query(`DELETE FROM eco_pautas WHERE codigo = $1`, [codigo()]);
  await admin.query(
    `DELETE FROM eco_auditoria
     WHERE (tabla = 'eco_multimedia' AND registro_id = ANY($1::text[]))
        OR (tabla = 'eco_productos' AND registro_id = $2)
        OR (tabla = 'eco_pautas' AND registro_id = $3)`,
    [ids.archivos.map(String), String(productoId), String(pauta?.id)],
  );
  await ctx?.cerrar();
});

const cambiarPromociones = (habilitado) =>
  comercial.pedir({
    method: 'PUT',
    url: '/api/configuracion/interruptores/promociones_habilitadas',
    payload: { habilitado },
  });

describe('integración: pautas', () => {
  it('crea una pauta vigente', async () => {
    const res = await comercial.pedir({
      method: 'POST',
      url: '/api/pautas',
      payload: {
        codigo: codigo(),
        nombre: 'Pauta de integración',
        mensajeCliente: 'Solo hoy',
        descuentoPct: 25,
        palabrasClave: ['oferta'],
        vigenteDesde: haceUnaHora(),
        vigenteHasta: enUnaHora(),
        activo: true,
      },
    });
    expect(res.statusCode).toBe(201);
    pauta = res.json();
    expect(pauta).toMatchObject({
      vigente: true,
      estadoVigencia: 'vigente',
      actualizadoPor: comercial.correo,
    });
  });

  it('rechaza un código repetido y una vigencia invertida', async () => {
    const base = {
      nombre: 'X',
      mensajeCliente: null,
      descuentoPct: null,
      palabrasClave: [],
      activo: true,
    };
    const repetido = await comercial.pedir({
      method: 'POST',
      url: '/api/pautas',
      payload: { ...base, codigo: codigo(), vigenteDesde: null, vigenteHasta: null },
    });
    expect(repetido.statusCode).toBe(409);
    const invertida = await comercial.pedir({
      method: 'POST',
      url: '/api/pautas',
      payload: {
        ...base,
        codigo: `${codigo()}-B`,
        vigenteDesde: enUnaHora(),
        vigenteHasta: haceUnaHora(),
      },
    });
    expect(invertida.statusCode).toBe(400);
  });

  it('desactivar la pauta deja a sus productos sin descuento, también el propio', async () => {
    const { rows } = await ctx.pool.query(
      `INSERT INTO eco_productos (codigo, nombre, tipo, familia, precio_base, descuento_pct, pauta_id, actualizado_por)
       VALUES ($1, 'Producto con pauta', 'equipo', 'prueba', 1000, 10, $2, 'test') RETURNING id`,
      [codigo(), pauta.id],
    );
    productoId = rows[0].id;
    const producto = async () =>
      (await comercial.pedir({ url: `/api/productos/${productoId}` })).json();
    expect((await producto()).descuentoVigentePct).toBe(25); // mayor entre 10 y 25

    const actual = (await comercial.pedir({ url: `/api/pautas/${pauta.id}` })).json();
    expect(actual.productosConDescuentoPropio).toBe(1);
    const res = await comercial.pedir({
      method: 'PATCH',
      url: `/api/pautas/${pauta.id}/activo`,
      payload: { activo: false, version: actual.version },
    });
    expect(res.json().estadoVigencia).toBe('inactiva');
    expect(await producto()).toMatchObject({ descuentoVigentePct: 0, precioFinal: 1000 });

    // Reactivamos para la siguiente prueba.
    await comercial.pedir({
      method: 'PATCH',
      url: `/api/pautas/${pauta.id}/activo`,
      payload: { activo: true, version: res.json().version },
    });
  });

  it('el rol lectura no puede crear pautas', async () => {
    const res = await lectura.pedir({ method: 'POST', url: '/api/pautas', payload: {} });
    expect(res.statusCode).toBe(403);
  });
});

describe('integración: multimedia', () => {
  const crear = (sufijo, tipo, conPauta) =>
    comercial.pedir({
      method: 'POST',
      url: '/api/multimedia',
      payload: {
        tipo,
        hubspotFileId: `${codigo()}-${sufijo}`,
        descripcion: `Archivo ${sufijo}`,
        productoId: null,
        color: null,
        tema: null,
        pautaId: conPauta ? pauta.id : null,
        orden: 100,
        activo: true,
      },
    });

  it('crea archivos y rechaza el mismo tipo + ID de HubSpot', async () => {
    for (const [sufijo, tipo, conPauta] of [
      ['img', 'imagen', false],
      ['promo-con-pauta', 'promocion', true],
      ['promo-sin-pauta', 'promocion', false],
    ]) {
      const res = await crear(sufijo, tipo, conPauta);
      expect(res.statusCode).toBe(201);
      ids.archivos.push(res.json().id);
    }
    expect((await crear('img', 'imagen', false)).statusCode).toBe(409);
    // Mismo ID con otro tipo sí se permite (UNIQUE es por tipo + ID).
    const otroTipo = await crear('img', 'video', false);
    expect(otroTipo.statusCode).toBe(201);
    ids.archivos.push(otroTipo.json().id);
  });

  it('comoLoVeElBot() coincide con lo que devuelve eco_contexto()', async () => {
    const original = (await comercial.pedir({ url: '/api/configuracion/interruptores' }))
      .json()
      .find((i) => i.clave === 'promociones_habilitadas');
    try {
      await cambiarPromociones(true);
      const { rows } = await ctx.pool.query(`SELECT eco_contexto('COMPRA') AS c`);
      const contexto = rows[0].c;
      const enLista = new Set(contexto.multimedia.map((m) => `${m.tipo}:${m.file_id}`));
      const enPauta = new Set(contexto.pautas.find((p) => p.codigo === codigo())?.imagenes ?? []);

      const archivos = (await comercial.pedir({ url: '/api/multimedia' }))
        .json()
        .filter((a) => a.hubspotFileId.startsWith(codigo()));
      expect(archivos).toHaveLength(4);
      for (const a of archivos) {
        const loVe = enLista.has(`${a.tipo}:${a.hubspotFileId}`) || enPauta.has(a.hubspotFileId);
        const esperado = comoLoVeElBot({
          tipo: a.tipo,
          activo: a.activo,
          pautaId: a.pauta?.id ?? null,
        });
        expect([a.hubspotFileId, a.tipo, loVe]).toEqual([
          a.hubspotFileId,
          a.tipo,
          esperado.visible,
        ]);
      }
    } finally {
      await cambiarPromociones(original.habilitado);
    }
  });
});
