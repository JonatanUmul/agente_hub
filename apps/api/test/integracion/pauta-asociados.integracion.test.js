import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conSeleccion } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

// Modelos y archivos asignados desde la pauta: eco_productos_pautas, eco_multimedia_pautas y la
// pauta principal del archivo (eco_multimedia.pauta_id), contra la base de Docker.
let ctx;
let comercial;
let pauta;
let otra;
const p = {}; // productos
const m = {}; // archivos
const prefijo = () => `ASOC-${ctx.sufijo}`;

const insertarProducto = async (sufijo, activo = true) =>
  (
    await ctx.pool.query(
      `INSERT INTO eco_productos (codigo, nombre, tipo, familia, precio_base, activo, actualizado_por)
       VALUES ($1, $1, 'equipo', 'prueba', 500, $2, 'test') RETURNING id`,
      [`${prefijo()}-${sufijo}`, activo],
    )
  ).rows[0].id;
const insertarArchivo = async (
  sufijo,
  { productoId = null, pautaId = null, activo = true } = {},
) => {
  const { rows } = await ctx.pool.query(
    `INSERT INTO eco_multimedia (tipo, hubspot_file_id, descripcion, producto_id, pauta_id, activo, actualizado_por)
     VALUES ('imagen', $1, $1, $2, $3, $4, 'test') RETURNING id`,
    [`${prefijo()}-${sufijo}`, productoId, pautaId, activo],
  );
  if (pautaId) {
    await ctx.pool.query(
      `INSERT INTO eco_multimedia_pautas (multimedia_id, pauta_id) VALUES ($1, $2)`,
      [rows[0].id, pautaId],
    );
  }
  return rows[0].id;
};
const principal = async (id) =>
  (await ctx.pool.query(`SELECT pauta_id FROM eco_multimedia WHERE id = $1`, [id])).rows[0]
    .pauta_id;
const leer = async () => (await comercial.pedir({ url: `/api/pautas/${pauta.id}` })).json();
const guardar = async (cambios) => {
  const actual = await leer();
  const { id: _id, codigo: _c, ...resto } = actual;
  return comercial.pedir({
    method: 'PUT',
    url: `/api/pautas/${pauta.id}`,
    payload: {
      nombre: resto.nombre,
      mensajeCliente: resto.mensajeCliente,
      descuentoPct: resto.descuentoPct,
      palabrasClave: resto.palabrasClave,
      vigenteDesde: resto.vigenteDesde,
      vigenteHasta: resto.vigenteHasta,
      activo: resto.activo,
      aplicaTodos: resto.aplicaTodos,
      productoIds: resto.productoIds,
      multimediaIds: resto.multimediaIds,
      version: resto.version,
      ...cambios,
    },
  });
};
const crearPauta = (sufijo, extra = {}) =>
  comercial.pedir({
    method: 'POST',
    url: '/api/pautas',
    payload: {
      codigo: `${prefijo()}-${sufijo}`,
      nombre: `Pauta ${sufijo}`,
      mensajeCliente: null,
      descuentoPct: null,
      palabrasClave: [],
      vigenteDesde: null,
      vigenteHasta: null,
      activo: true,
      aplicaTodos: false,
      productoIds: [],
      multimediaIds: [],
      ...extra,
    },
  });

beforeAll(async () => {
  ctx = await crearContexto();
  comercial = await ctx.sesionCon('comercial');
  otra = (await crearPauta('OTRA')).json();
  p.equipo = await insertarProducto('EQ');
  p.inactivo = await insertarProducto('INACT', false);
  m.suelto = await insertarArchivo('SUELTO', { productoId: p.equipo });
  m.deOtra = await insertarArchivo('DE-OTRA', { productoId: p.equipo, pautaId: otra.id });
  m.inactivo = await insertarArchivo('INACT', { activo: false });
});

afterAll(async () => {
  const admin = ctx.poolAdmin;
  const like = `${prefijo()}%`;
  const { rows } = await admin.query(
    `SELECT 'eco_multimedia' AS t, id::text FROM eco_multimedia WHERE hubspot_file_id LIKE $1
     UNION ALL SELECT 'eco_productos', id::text FROM eco_productos WHERE codigo LIKE $1
     UNION ALL SELECT 'eco_pautas', id::text FROM eco_pautas WHERE codigo LIKE $1`,
    [like],
  );
  await admin.query(`DELETE FROM eco_multimedia WHERE hubspot_file_id LIKE $1`, [like]);
  await admin.query(`DELETE FROM eco_productos WHERE codigo LIKE $1`, [like]);
  await admin.query(`DELETE FROM eco_pautas WHERE codigo LIKE $1`, [like]);
  await admin.query(
    `DELETE FROM eco_auditoria WHERE registro_id = ANY($1::text[]) AND tabla LIKE 'eco_%'`,
    [rows.map((r) => r.id)],
  );
  await ctx?.cerrar();
});

describe('integración: modelos y archivos desde la pauta', () => {
  it('crea la pauta con sus modelos y archivos; el archivo sin principal la toma', async () => {
    const res = await crearPauta('PRINCIPAL', {
      productoIds: [p.equipo],
      multimediaIds: [m.suelto, m.deOtra],
    });
    expect(res.statusCode).toBe(201);
    pauta = res.json();
    expect(pauta).toMatchObject({
      aplicaTodos: false,
      productoIds: [p.equipo],
      multimediaIds: [m.suelto, m.deOtra].sort((a, b) => a - b),
      productosActivos: 1,
      archivosActivos: 2,
    });
    expect(await principal(m.suelto)).toBe(pauta.id);
    expect(await principal(m.deOtra)).toBe(otra.id); // ya tenía principal: se respeta

    const { rows } = await ctx.pool.query(
      `SELECT actualizado_por FROM eco_productos_pautas WHERE pauta_id = $1`,
      [pauta.id],
    );
    expect(rows).toEqual([{ actualizado_por: comercial.correo }]);
    const resumen = (await comercial.pedir({ url: '/api/pautas/resumen' }))
      .json()
      .find((r) => r.id === pauta.id);
    expect(resumen).toMatchObject({ aplicaTodos: false, productoIds: [p.equipo] });
  });

  it('al quitar un archivo, su principal pasa a otra pauta o queda vacía (igual que la vista previa)', async () => {
    // m.deOtra pasa a tener como principal esta pauta, para probar el cambio a la otra.
    await ctx.pool.query(`UPDATE eco_multimedia SET pauta_id = $1 WHERE id = $2`, [
      pauta.id,
      m.deOtra,
    ]);
    const archivos = (await comercial.pedir({ url: '/api/multimedia' })).json();
    const esperado = conSeleccion(archivos, pauta.id, []);
    expect((await guardar({ multimediaIds: [] })).statusCode).toBe(200);
    for (const id of [m.suelto, m.deOtra]) {
      expect(await principal(id)).toBe(esperado.find((a) => a.id === id).pautaIdPrincipal);
    }
    expect(await principal(m.suelto)).toBeNull();
    expect(await principal(m.deOtra)).toBe(otra.id);
  });

  it('rechaza lo nuevo inactivo, pero conserva lo inactivo ya asociado', async () => {
    const nuevo = await guardar({ productoIds: [p.equipo, p.inactivo] });
    expect(nuevo.statusCode).toBe(400);
    expect(nuevo.json().error.codigo).toBe('ASOCIADO_NO_VALIDO');
    expect((await guardar({ multimediaIds: [m.inactivo] })).statusCode).toBe(400);

    await ctx.pool.query(
      `INSERT INTO eco_productos_pautas (producto_id, pauta_id) VALUES ($1, $2)`,
      [p.inactivo, pauta.id],
    );
    const res = await guardar({ nombre: 'Pauta renombrada' });
    expect(res.statusCode).toBe(200);
    expect(res.json().productoIds).toContain(p.inactivo);
  });

  it('«Aplica a todos los modelos» conserva los modelos para cuando se apague', async () => {
    const res = await guardar({ aplicaTodos: true, productoIds: [] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ aplicaTodos: true });
    expect(res.json().productoIds).toEqual([p.equipo, p.inactivo].sort((a, b) => a - b));
  });

  it('el producto sigue viendo sus pautas desde Productos', async () => {
    await guardar({ aplicaTodos: false, productoIds: [p.equipo] });
    const producto = (await comercial.pedir({ url: `/api/productos/${p.equipo}` })).json();
    expect(producto.pautas.map((pa) => pa.id)).toContain(pauta.id);
    const { rows } = await ctx.pool.query(`SELECT pauta_id FROM eco_productos WHERE id = $1`, [
      p.equipo,
    ]);
    expect(rows[0].pauta_id).toBe(pauta.id); // eco_productos.pauta_id = su primera pauta
  });

  it('una versión vieja responde 409', async () => {
    const res = await guardar({ version: '2000-01-01 00:00:00+00' });
    expect(res.statusCode).toBe(409);
  });
});
