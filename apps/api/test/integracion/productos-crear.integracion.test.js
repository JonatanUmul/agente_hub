import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAMPOS_FICHA, CAMPOS_VISION } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

// Crear productos (cerámica por variantes), ItemCode único sin importar mayúsculas y cambio de ItemCode
// con su paso de impacto, contra la base de Docker.
let ctx;
let comercial;
let flor;
const prefijo = () => `T${ctx.sufijo.replace(/\D/g, '')}`;

beforeAll(async () => {
  ctx = await crearContexto();
  comercial = await ctx.sesionCon('comercial');
});

afterAll(async () => {
  const admin = ctx.poolAdmin;
  const like = `${prefijo()}%`;
  const { rows } = await admin.query(`SELECT id::text FROM eco_productos WHERE codigo LIKE $1`, [
    like,
  ]);
  const ids = rows.map((r) => r.id);
  await admin.query(`DELETE FROM eco_multimedia WHERE hubspot_file_id LIKE $1`, [like]);
  await admin.query(`DELETE FROM eco_reglas_bot WHERE codigo LIKE $1`, [like]);
  await admin.query(`DELETE FROM eco_productos WHERE codigo LIKE $1`, [like]);
  await admin.query(
    `DELETE FROM eco_auditoria
     WHERE (tabla = 'eco_productos' AND registro_id = ANY($1::text[]))
        OR (tabla IN ('eco_multimedia', 'eco_reglas_bot') AND despues->>'hubspot_file_id' LIKE $2)
        OR (tabla = 'eco_reglas_bot' AND despues->>'codigo' LIKE $2)`,
    [ids, like],
  );
  await ctx?.cerrar();
});

const nuevo = (cambios = {}) => ({
  codigo: `${prefijo()}-flor-azul`,
  nombre: 'Ecofiltro Cerámica Flor Azul',
  tipo: 'equipo',
  familia: 'CERAMICA',
  capacidadLitros: null,
  variante: 'Flor Azul',
  nombreCorto: 'Cerámica Flor Azul',
  precioBase: 450,
  descuentoPct: 0,
  estado: 'disponible',
  colores: [],
  palabrasClave: ['cerámica'],
  pautaIds: [],
  orden: 100,
  activo: false,
  ...Object.fromEntries(
    [...CAMPOS_FICHA, ...CAMPOS_VISION].map((c) => [
      c,
      c === 'caracteristicas' || c === 'fotosReferencia' ? [] : null,
    ]),
  ),
  material: 'Cerámica',
  ...cambios,
});
const crear = (datos) => comercial.pedir({ method: 'POST', url: '/api/productos', payload: datos });
const guardar = async (id, cambios) => {
  const p = (await comercial.pedir({ url: `/api/productos/${id}` })).json();
  return comercial.pedir({
    method: 'PUT',
    url: `/api/productos/${id}`,
    payload: {
      codigo: p.codigo,
      variante: p.variante,
      nombreCorto: p.nombreCorto,
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

describe('integración: crear productos', () => {
  it('crea una variante de cerámica con su precio y el ItemCode en mayúsculas', async () => {
    const res = await crear(nuevo());
    expect(res.statusCode).toBe(201);
    flor = res.json();
    expect(flor).toMatchObject({
      codigo: `${prefijo()}-FLOR-AZUL`,
      familia: 'CERAMICA',
      variante: 'Flor Azul',
      nombreCorto: 'Cerámica Flor Azul',
      precioBase: 450,
      actualizadoPor: comercial.correo,
    });
  });

  it('las demás variantes se cargan cambiando solo código, variante y precio', async () => {
    for (const [variante, precio] of [
      ['Cola de Ratón', 460],
      ['Flor Silvestre', 470],
      ['Agua', 480],
    ]) {
      const sinTildes = variante.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const codigo = `${prefijo()}-${sinTildes.toUpperCase().replace(/\s+/g, '-')}`;
      const res = await crear(nuevo({ codigo, variante, precioBase: precio }));
      expect(res.statusCode).toBe(201);
    }
  });

  it('no deja repetir un ItemCode, sin importar mayúsculas, y dice con cuál choca', async () => {
    const res = await crear(nuevo({ codigo: `${prefijo()}-Flor-Azul` }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.mensaje).toContain('«Ecofiltro Cerámica Flor Azul»');
  });

  it('exige precio salvo descontinuado', async () => {
    const sinPrecio = await crear(nuevo({ codigo: `${prefijo()}-X`, precioBase: null }));
    expect(sinPrecio.statusCode).toBe(400);
    const descontinuado = await crear(
      nuevo({ codigo: `${prefijo()}-Y`, precioBase: null, estado: 'descontinuado' }),
    );
    expect(descontinuado.statusCode).toBe(201);
  });
});

describe('integración: cambiar el ItemCode', () => {
  it('muestra dependencias y textos que escriben el código viejo', async () => {
    await ctx.pool.query(
      `INSERT INTO eco_multimedia (tipo, hubspot_file_id, descripcion, producto_id, color, actualizado_por)
       VALUES ('imagen', $1, 'Flor azul', $2, 'Azul', 'test')`,
      [`${prefijo()}-foto`, flor.id],
    );
    await ctx.pool.query(
      `INSERT INTO eco_reglas_bot (codigo, categoria, titulo, regla, actualizado_por)
       VALUES ($1, 'precios', 'Precio cerámica', $2, 'test')`,
      [`${prefijo()}-REGLA`, `Usa [[PRECIO:${flor.codigo}]] para la cerámica.`],
    );
    const res = await comercial.pedir({
      url: `/api/productos/${flor.id}/impacto-codigo?codigo=${prefijo()}-FLOR-AZUL-2`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      conflicto: null,
      dependencias: { multimedia: 1, productosPautas: 0, multimediaPautas: 0 },
      menciones: [{ tabla: 'eco_reglas_bot', etiqueta: `${prefijo()}-REGLA · Precio cerámica` }],
    });

    const choque = await comercial.pedir({
      url: `/api/productos/${flor.id}/impacto-codigo?codigo=${prefijo()}-agua`,
    });
    expect(choque.json().conflicto).toMatchObject({ codigo: `${prefijo()}-AGUA` });
  });

  it('exige confirmar, guarda en mayúsculas y el historial registra el código anterior', async () => {
    const codigoNuevo = `${prefijo()}-FLOR-AZUL-2`;
    expect((await guardar(flor.id, { codigo: codigoNuevo })).statusCode).toBe(400);
    const res = await guardar(flor.id, {
      codigo: codigoNuevo.toLowerCase(),
      confirmarCambioCodigo: true,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().codigo).toBe(codigoNuevo);

    const { rows } = await ctx.poolAdmin.query(
      `SELECT antes->>'codigo' AS antes, despues->>'codigo' AS despues
       FROM eco_auditoria WHERE tabla = 'eco_productos' AND registro_id = $1 AND operacion = 'UPDATE'
       ORDER BY id DESC LIMIT 1`,
      [String(flor.id)],
    );
    expect(rows[0]).toEqual({ antes: flor.codigo, despues: codigoNuevo });
  });

  it('avisa del color sin foto activa', async () => {
    const res = await guardar(flor.id, { colores: ['azul', 'rojo'] });
    expect(res.json().coloresConFoto).toEqual(['Azul']);
  });
});
