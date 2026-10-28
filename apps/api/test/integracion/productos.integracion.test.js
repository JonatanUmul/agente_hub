import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CAMPOS_FICHA,
  calcularPrecioFinal,
  descuentoVigente,
  fichaQueVeElBot,
} from '@ecofiltro/shared';
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

// Filas de la ficha (fichaQueVeElBot) ↔ columnas que eco_contexto() envía en el catálogo.
const COLUMNAS_POR_ETIQUETA = {
  'Descripción corta': ['descripcion_corta'],
  Descripción: ['descripcion'],
  Características: ['caracteristicas'],
  Material: ['material'],
  Capacidad: ['capacidad_texto'],
  'Capacidad del purificador': ['capacidad_purificador_litros'],
  'Tasa de filtrado': ['tasa_filtrado'],
  'Compatible con': ['compatible_con'],
  Medidas: ['ancho_cm', 'alto_cm', 'largo_cm'],
  Peso: ['peso_lb'],
};

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
  ...Object.fromEntries(CAMPOS_FICHA.map((c) => [c, p[c]])),
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

  it('guarda la ficha y eco_contexto() la entrega al bot sin los campos vacíos', async () => {
    const res = await comercial.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: datosEditables(await obtener(), {
        descripcionCorta: 'Resumen',
        caracteristicas: ['Fácil de limpiar', 'Purificador de 10 L'],
        material: '',
        capacidadPurificadorLitros: 10,
        anchoCm: 37.5,
        altoCm: 59,
        pesoLb: 12.5,
        urlWeb: 'https://ecofiltro.com.gt/producto/prueba/',
      }),
    });
    expect(res.statusCode).toBe(200);
    const guardado = res.json();
    expect(guardado).toMatchObject({ material: null, anchoCm: 37.5, pesoLb: 12.5 });

    const { rows } = await ctx.pool.query(`SELECT eco_contexto('COMPRA') AS c`);
    const enElBot = rows[0].c.catalogo.find((p) => p.codigo === codigo());
    expect(enElBot).toMatchObject({
      descripcion_corta: 'Resumen',
      caracteristicas: ['Fácil de limpiar', 'Purificador de 10 L'],
      capacidad_purificador_litros: 10,
      ancho_cm: 37.5,
      alto_cm: 59,
      peso_lb: 12.5,
    });
    for (const vacio of ['descripcion', 'material', 'largo_cm', 'tasa_filtrado', 'compatible_con'])
      expect(enElBot).not.toHaveProperty(vacio);

    // Paridad: la vista previa de la web muestra una fila si y solo si la función envía su columna.
    const etiquetas = fichaQueVeElBot(guardado).map((f) => f.etiqueta);
    for (const [etiqueta, columnas] of Object.entries(COLUMNAS_POR_ETIQUETA)) {
      const enviada = columnas.some((columna) => columna in enElBot);
      expect([etiqueta, etiquetas.includes(etiqueta)]).toEqual([etiqueta, enviada]);
    }
  });

  it('sin características guarda NULL y el bot no las recibe', async () => {
    await comercial.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: datosEditables(await obtener(), { caracteristicas: [] }),
    });
    const { rows } = await ctx.pool.query(
      `SELECT caracteristicas FROM eco_productos WHERE id = $1`,
      [productoId],
    );
    expect(rows[0].caracteristicas).toBeNull();
    const { rows: contexto } = await ctx.pool.query(`SELECT eco_contexto('COMPRA') AS c`);
    expect(contexto[0].c.catalogo.find((p) => p.codigo === codigo())).not.toHaveProperty(
      'caracteristicas',
    );
  });

  it('rechaza "compatible con" en un equipo', async () => {
    const res = await comercial.pedir({
      method: 'PUT',
      url: `/api/productos/${productoId}`,
      payload: datosEditables(await obtener(), { compatibleCon: 'Tonelito' }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.codigo).toBe('CAMPO_NO_APLICA');
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
