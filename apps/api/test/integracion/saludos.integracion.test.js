import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ahoraEnGuatemala, candidatosSaludo, resolverSaludo } from '@ecofiltro/shared';
import { crearContexto } from './contexto.js';

let ctx;
let contenido;
const ids = [];
const nombre = (n) => `Prueba ${ctx.sufijo} ${n}`;

beforeAll(async () => {
  ctx = await crearContexto();
  contenido = await ctx.sesionCon('contenido');
});

afterAll(async () => {
  await ctx.poolAdmin.query(`DELETE FROM eco_saludos WHERE nombre LIKE $1`, [`%${ctx.sufijo}%`]);
  await ctx.poolAdmin.query(
    `DELETE FROM eco_auditoria WHERE tabla = 'eco_saludos' AND registro_id = ANY($1::text[])`,
    [ids.map(String)],
  );
  await ctx?.cerrar();
});

const crear = (n, extra = {}) =>
  contenido.pedir({
    method: 'POST',
    url: '/api/saludos',
    payload: {
      nombre: nombre(n),
      modulo: 'DISTRIBUIDOR',
      saludo: '¡{momento}! Saludo de prueba',
      fechaInicio: null,
      fechaFin: null,
      repetirAnual: false,
      prioridad: -500,
      activo: true,
      ...extra,
    },
  });

describe('integración: saludos', () => {
  it('crea, avisa choques y responde 409 con un nombre repetido en el módulo', async () => {
    const a = await crear(1);
    expect(a.statusCode).toBe(201);
    ids.push(a.json().id);
    expect(a.json()).toMatchObject({
      actualizadoPor: contenido.correo,
      vigenteHoy: true,
      choques: [],
    });

    const b = await crear(2);
    ids.push(b.json().id);
    expect(b.json().choques).toEqual([{ id: a.json().id, nombre: nombre(1) }]);

    const repetido = await crear(1);
    expect(repetido.statusCode).toBe(409);
    expect(repetido.json().error.codigo).toBe('NOMBRE_EN_USO');
  });

  it('valida fechas y comodín en el servidor', async () => {
    expect((await crear(3, { saludo: 'Hola {nombre}' })).statusCode).toBe(400);
    expect((await crear(3, { fechaInicio: '2026-12-15', fechaFin: null })).statusCode).toBe(400);
  });

  it('edita, desactiva y borra con la versión vigente', async () => {
    const id = ids[1];
    const lista = (await contenido.pedir({ url: '/api/saludos?modulo=DISTRIBUIDOR' })).json();
    const actual = lista.find((s) => s.id === id);
    const editado = await contenido.pedir({
      method: 'PUT',
      url: `/api/saludos/${id}`,
      payload: {
        nombre: actual.nombre,
        modulo: actual.modulo,
        saludo: actual.saludo,
        fechaInicio: '2026-12-31',
        fechaFin: '2027-01-03',
        repetirAnual: true,
        prioridad: actual.prioridad,
        activo: actual.activo,
        version: actual.version,
      },
    });
    expect(editado.json()).toMatchObject({ fechaInicio: '2026-12-31', fechaFin: '2027-01-03' });

    const desactivado = await contenido.pedir({
      method: 'PATCH',
      url: `/api/saludos/${id}/activo`,
      payload: { activo: false, version: editado.json().version },
    });
    expect(desactivado.json()).toMatchObject({ activo: false, vigenteHoy: false });

    const borrado = await contenido.pedir({
      method: 'DELETE',
      url: `/api/saludos/${id}?version=${encodeURIComponent(desactivado.json().version)}`,
    });
    expect(borrado.statusCode).toBe(204);
  });

  it('la simulación de hoy coincide con eco_saludo() en todos los módulos', async () => {
    const todos = (await contenido.pedir({ url: '/api/saludos' })).json();
    for (const modulo of ['MENU', 'COMPRA', 'SAC', 'DISTRIBUIDOR', 'GLOBAL']) {
      const { fecha, hora } = ahoraEnGuatemala();
      const vigente = (
        await contenido.pedir({ url: `/api/saludos/vigente?modulo=${modulo}` })
      ).json();
      const esperados = candidatosSaludo(todos, modulo, fecha).map((s) =>
        resolverSaludo(s.saludo, hora),
      );
      if (esperados.length === 0) expect(vigente.saludo).toBeNull();
      else expect(esperados).toContain(vigente.saludo);

      const simulado = (
        await contenido.pedir({
          url: `/api/saludos/simular?modulo=${modulo}&fecha=${fecha}&hora=${hora}`,
        })
      ).json();
      expect(simulado.candidatos.map((c) => c.saludo).sort()).toEqual([...esperados].sort());
    }
  });
});
