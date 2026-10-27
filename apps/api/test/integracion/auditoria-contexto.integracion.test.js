import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearContexto } from './contexto.js';

let ctx;
let comercial;
let lectura;
let productoId;
const codigo = () => `TEST-${ctx.sufijo}`;

beforeAll(async () => {
  ctx = await crearContexto();
  comercial = await ctx.sesionCon('comercial');
  lectura = await ctx.sesionCon('lectura');
  const { rows } = await ctx.pool.query(
    `INSERT INTO eco_productos (codigo, nombre, tipo, familia, precio_base, actualizado_por)
     VALUES ($1, 'Producto auditado', 'equipo', 'prueba', 100, $2) RETURNING id`,
    [codigo(), comercial.correo],
  );
  productoId = rows[0].id;
});

afterAll(async () => {
  await ctx.poolAdmin.query(`DELETE FROM eco_productos WHERE codigo = $1`, [codigo()]);
  await ctx.poolAdmin.query(
    `DELETE FROM eco_auditoria WHERE tabla = 'eco_productos' AND registro_id = $1`,
    [String(productoId)],
  );
  await ctx?.cerrar();
});

const historial = async (persona, query) =>
  (await persona.pedir({ url: `/api/auditoria?${new URLSearchParams(query)}` })).json();

describe('integración: auditoría', () => {
  it('un cambio desde la app aparece con su autor y solo los campos cambiados', async () => {
    const actual = (await comercial.pedir({ url: `/api/productos/${productoId}` })).json();
    await comercial.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: {
        precioBase: 150,
        descuentoPct: actual.descuentoPct,
        estado: actual.estado,
        colores: actual.colores,
        palabrasClave: actual.palabrasClave,
        pautaIds: [],
        orden: actual.orden,
        activo: actual.activo,
        version: actual.version,
      },
    });

    const { entradas } = await historial(lectura, {
      tabla: 'eco_productos',
      registroId: String(productoId),
      operacion: 'UPDATE',
    });
    expect(entradas[0]).toMatchObject({
      origen: 'app',
      usuarioApp: comercial.correo,
      usuarioDb: 'eco_app',
      etiqueta: `Producto auditado (${codigo()})`,
      cambios: [{ campo: 'precio_base', antes: 100, despues: 150 }],
    });
  });

  it('un cambio directo en la base NO se atribuye a quien editó antes', async () => {
    // El superusuario cambia el precio sin tocar actualizado_por (que sigue siendo el comercial).
    await ctx.poolAdmin.query(`UPDATE eco_productos SET precio_base = 175 WHERE id = $1`, [
      productoId,
    ]);
    const { entradas } = await historial(lectura, {
      tabla: 'eco_productos',
      registroId: String(productoId),
    });
    expect(entradas[0]).toMatchObject({ origen: 'directo', usuarioApp: null });
    expect(entradas[0].usuarioDb).not.toBe('eco_app');

    const delComercial = await historial(lectura, {
      tabla: 'eco_productos',
      registroId: String(productoId),
      usuario: comercial.correo.toUpperCase(),
    });
    expect(delComercial.entradas.every((e) => e.origen === 'app')).toBe(true);
    expect(delComercial.entradas.map((e) => e.cambios[0]?.despues)).not.toContain(175);
  });

  it('pagina con cursor sin repetir ni saltar registros', async () => {
    const filtros = { tabla: 'eco_productos', registroId: String(productoId) };
    const todas = (await historial(lectura, { ...filtros, limite: 200 })).entradas.map((e) => e.id);
    expect(todas.length).toBeGreaterThanOrEqual(3);

    const vistas = [];
    let antesDe;
    do {
      const pagina = await historial(lectura, {
        ...filtros,
        limite: 1,
        ...(antesDe && { antesDe }),
      });
      vistas.push(...pagina.entradas.map((e) => e.id));
      antesDe = pagina.siguiente;
    } while (antesDe);
    expect(vistas).toEqual(todas);
  });

  it('rechaza filtros inválidos', async () => {
    const res = await lectura.pedir({ url: '/api/auditoria?tabla=eventos' });
    expect(res.statusCode).toBe(400);
  });
});

describe('integración: vista previa del contexto', () => {
  it('devuelve exactamente lo que devuelve eco_contexto() para el módulo', async () => {
    const res = await lectura.pedir({ url: '/api/contexto/SAC' });
    expect(res.statusCode).toBe(200);
    const { rows } = await ctx.pool.query(`SELECT eco_contexto('SAC') AS c`);
    const { generado_en: _a, ...api } = res.json();
    const { generado_en: _b, ...sql } = rows[0].c;
    expect(api).toEqual(sql);
  });

  it('rechaza un módulo que no existe', async () => {
    expect((await lectura.pedir({ url: '/api/contexto/VENTAS' })).statusCode).toBe(400);
  });
});
