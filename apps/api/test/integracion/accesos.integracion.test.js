import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ultimosDias } from '@ecofiltro/shared';
import { CONTRASENA_PRUEBA, crearContexto } from './contexto.js';

// Entradas, salidas y movimientos de los usuarios de la app, contra la base de Docker.
let ctx;
let admin;
beforeAll(async () => {
  ctx = await crearContexto();
  admin = await ctx.sesionCon('admin');
});
afterAll(() => ctx?.cerrar());

const hoy = new URLSearchParams(ultimosDias(1)).toString();
const accesos = async (extra = '') => {
  const res = await admin.pedir({ url: `/api/accesos?${hoy}${extra}` });
  expect(res.statusCode).toBe(200);
  return res.json();
};
const login = (correo, contrasena = CONTRASENA_PRUEBA) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { correo, contrasena },
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36' },
  });

describe('integración: control de accesos', () => {
  it('registra la entrada y la salida con su motivo', async () => {
    const lectura = await ctx.sesionCon('lectura');
    const { id } = (await admin.pedir({ url: '/api/usuarios' }))
      .json()
      .find((u) => u.correo === lectura.correo);

    const abierta = (await accesos(`&usuarioId=${id}`)).sesiones;
    expect(abierta).toHaveLength(1);
    expect(abierta[0]).toMatchObject({ motivo: 'abierta', enLinea: true });

    expect((await lectura.pedir({ method: 'POST', url: '/api/auth/logout' })).statusCode).toBe(204);
    const { sesiones, resumen } = await accesos(`&usuarioId=${id}`);
    expect(sesiones[0]).toMatchObject({ motivo: 'salida', enLinea: false });
    expect(resumen).toEqual([expect.objectContaining({ usuarioId: id, sesiones: 1 })]);
  });

  it('guarda navegador, anota fallos y el cierre de sesiones por un admin', async () => {
    const comercial = await ctx.sesionCon('contenido');
    const { id } = (await admin.pedir({ url: '/api/usuarios' }))
      .json()
      .find((u) => u.correo === comercial.correo);

    expect((await login(comercial.correo, 'incorrecta-123')).statusCode).toBe(401);
    expect((await login(comercial.correo)).statusCode).toBe(200);
    const cierre = await admin.pedir({
      method: 'POST',
      url: `/api/usuarios/${id}/cerrar-sesiones`,
    });
    expect(cierre.statusCode).toBe(204);

    const { sesiones, eventos, resumen } = await accesos(`&usuarioId=${id}`);
    expect(sesiones.map((s) => s.motivo)).toEqual(['cerrada_por_admin', 'cerrada_por_admin']);
    expect(sesiones[0].navegador).toContain('Chrome');
    expect(eventos.map((e) => e.evento)).toEqual(['sesiones_cerradas', 'acceso_fallido', 'creado']);
    expect(eventos[0].hechoPor).toBe(admin.correo);
    expect(eventos[1].detalle).toEqual({ motivo: 'contrasena' });
    expect(eventos[2].hechoPor).toBe('consola');
    expect(resumen[0]).toMatchObject({ fallidos: 1, enLinea: false });
    expect((await comercial.pedir({ url: '/api/auth/sesion' })).statusCode).toBe(401);
  });

  it('anota el cambio de rol con antes y después', async () => {
    const { id } = (await admin.pedir({ url: '/api/usuarios' }))
      .json()
      .find((u) => u.correo === admin.correo);
    const otro = (await admin.pedir({ url: '/api/usuarios' }))
      .json()
      .find((u) => u.id !== id && u.correo.endsWith(`-${ctx.sufijo}@prueba.local`));
    await admin.pedir({
      method: 'PATCH',
      url: `/api/usuarios/${otro.id}`,
      payload: { rol: 'admin' },
    });
    const { eventos } = await accesos(`&usuarioId=${otro.id}`);
    expect(eventos[0]).toMatchObject({
      evento: 'editado',
      detalle: { rol: { antes: otro.rol, despues: 'admin' } },
      hechoPor: admin.correo,
    });
  });

  it('solo un admin ve el control de accesos', async () => {
    const comercial = await ctx.sesionCon('comercial');
    expect((await comercial.pedir({ url: `/api/accesos?${hoy}` })).statusCode).toBe(403);
  });
});
