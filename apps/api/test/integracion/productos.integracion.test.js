import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calcularPrecioFinal, descuentoVigente } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

let ctx;
let comercial;
let contenido;
let productoId;
const codigo = () => `TEST-${ctx.sufijo}`;

beforeAll(async () => {
  ctx = await crearContexto();
  comercial = await ctx.sesionCon('comercial');
  contenido = await ctx.sesionCon('contenido');
  const { rows } = await ctx.pool.query(
    `INSERT INTO eco_productos (codigo, nombre, tipo, familia, precio_base, actualizado_por)
     VALUES ($1, 'Producto de integración', 'equipo', 'prueba', 1000, 'test') RETURNING id`,
    [codigo()],
  );
  productoId = rows[0].id;
});

afterAll(async () => {
  // eco_app no puede borrar: limpiamos con el superusuario del contenedor de desarrollo.
  await ctx.poolAdmin.query(`DELETE FROM eco_productos WHERE codigo = $1`, [codigo()]);
  await ctx.poolAdmin.query(
    `DELETE FROM eco_auditoria WHERE tabla = 'eco_productos' AND registro_id = $1`,
    [String(productoId)],
  );
  await ctx?.cerrar();
});

const obtener = async () => (await comercial.pedir({ url: `/api/productos/${productoId}` })).json();
const datosEditables = (p, cambios = {}) => ({
  precioBase: p.precioBase,
  descuentoPct: p.descuentoPct,
  estado: p.estado,
  colores: p.colores,
  palabrasClave: p.palabrasClave,
  pautaIds: p.pautas.map((pa) => pa.id),
  orden: p.orden,
  activo: p.activo,
  version: p.version,
  ...cambios,
});

describe('integración: precio final', () => {
  it('calcularPrecioFinal coincide con round() de PostgreSQL en 2000 casos', async () => {
    const precios = [];
    const descuentos = [];
    for (let i = 0; i < 2000; i++) {
      precios.push(Math.round(Math.random() * 10_000_000) / 100);
      descuentos.push(Math.round(Math.random() * 10_000) / 100);
    }
    // Misma expresión que eco_contexto(); los valores pasan por numeric(10,2) / numeric(5,2).
    const { rows } = await ctx.pool.query(
      `SELECT round(p::numeric(10,2) * (1 - d::numeric(5,2) / 100.0), 2)::text AS final
       FROM unnest($1::numeric[], $2::numeric[]) AS t(p, d)`,
      [precios, descuentos],
    );
    const diferencias = rows.filter(
      (fila, i) => Number(fila.final) !== calcularPrecioFinal(precios[i], descuentos[i]),
    );
    expect(diferencias).toEqual([]);
  });
});

describe('integración: descuento vigente', () => {
  it('descuentoVigente() de shared coincide con eco_v_catalogo para todos los productos activos', async () => {
    const productos = (await comercial.pedir({ url: '/api/productos' }))
      .json()
      .filter((p) => p.activo);
    expect(productos.length).toBeGreaterThan(0);
    for (const p of productos) {
      expect([p.codigo, descuentoVigente(p)]).toEqual([p.codigo, p.descuentoVigentePct]);
    }
  });
});

describe('integración: edición de productos', () => {
  it('comercial edita, se calcula el precio y la auditoría registra su correo', async () => {
    const actual = await obtener();
    const res = await comercial.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: datosEditables(actual, { precioBase: 1249.99, descuentoPct: 10, colores: ['azul'] }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      precioBase: 1249.99,
      descuentoVigentePct: 10,
      precioFinal: 1124.99,
      actualizadoPor: comercial.correo,
    });
    expect(res.json().version).not.toBe(actual.version);

    const { rows } = await ctx.pool.query(
      `SELECT despues->>'actualizado_por' AS por, despues->>'precio_base' AS precio
       FROM eco_auditoria WHERE tabla = 'eco_productos' AND registro_id = $1 AND operacion = 'UPDATE'
       ORDER BY id DESC LIMIT 1`,
      [String(productoId)],
    );
    expect(rows[0]).toEqual({ por: comercial.correo, precio: '1249.99' });
  });

  it('rechaza con 409 una edición basada en una versión vieja', async () => {
    const vieja = await obtener();
    await comercial.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: datosEditables(vieja, { orden: 7 }),
    });
    const res = await comercial.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: datosEditables(vieja, { orden: 8 }),
    });
    expect(res.statusCode).toBe(409);
    expect((await obtener()).orden).toBe(7);
  });

  it('guardar sin cambios no genera auditoría', async () => {
    const contar = async () =>
      (
        await ctx.pool.query(
          `SELECT count(*)::int AS n FROM eco_auditoria WHERE tabla = 'eco_productos' AND registro_id = $1`,
          [String(productoId)],
        )
      ).rows[0].n;
    const antes = await contar();
    const actual = await obtener();
    await comercial.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: datosEditables(actual),
    });
    expect(await contar()).toBe(antes);
  });

  it('un producto inactivo no tiene precio final (el bot no lo ve)', async () => {
    const actual = await obtener();
    const res = await comercial.pedir({
      method: 'PATCH',
      url: `/api/productos/${productoId}/activo`,
      payload: { activo: false, version: actual.version },
    });
    expect(res.json()).toMatchObject({
      activo: false,
      descuentoVigentePct: null,
      precioFinal: null,
    });
  });

  it('el rol contenido puede ver pero no editar productos', async () => {
    expect((await contenido.pedir({ url: '/api/productos' })).statusCode).toBe(200);
    const actual = await obtener();
    const res = await contenido.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: datosEditables(actual),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('integración: interruptores', () => {
  it('encender precios se refleja en eco_contexto() y se puede revertir', async () => {
    const leer = async () =>
      (await comercial.pedir({ url: '/api/configuracion/interruptores' })).json();
    const original = (await leer()).find((i) => i.clave === 'precios_habilitados');
    expect(original).toBeDefined();

    try {
      const res = await comercial.pedir({
        method: 'PUT',
        url: '/api/configuracion/interruptores/precios_habilitados',
        payload: { habilitado: true },
      });
      expect(res.json()).toMatchObject({ habilitado: true, actualizadoPor: comercial.correo });

      const { rows } = await ctx.pool.query(`SELECT eco_contexto('COMPRA') AS c`);
      expect(rows[0].c.precios_habilitados).toBe(true);
      const { rows: valor } = await ctx.pool.query(
        `SELECT valor FROM eco_configuracion WHERE clave = 'precios_habilitados'`,
      );
      expect(valor[0].valor).toBe('true');
    } finally {
      await comercial.pedir({
        method: 'PUT',
        url: '/api/configuracion/interruptores/precios_habilitados',
        payload: { habilitado: original.habilitado },
      });
    }
  });
});
