import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cargarEnv } from '../../src/config/env.js';
import { crearPool } from '../../src/db/pool.js';
import { crearUsuario } from '../../src/modules/usuarios/usuarios.service.js';

// Flujo completo contra la base de Docker. Usa correos únicos y los borra al final.
const sufijo = Date.now();
const CONTRASENA = 'contrasena-de-prueba-123';
const correoAdmin = `admin-${sufijo}@prueba.local`;
const correoLectura = `lectura-${sufijo}@prueba.local`;
const correoBloqueo = `bloqueo-${sufijo}@prueba.local`;

let app;
let pool;
beforeAll(async () => {
  // Rate limit alto para que no interfiera con las pruebas de bloqueo por intentos.
  const config = cargarEnv({ ...process.env, LOGIN_RATE_LIMIT_POR_MINUTO: '1000' });
  pool = crearPool(config);
  app = await crearApp({ config, pool, logger: false });
  for (const [correo, rol] of [
    [correoAdmin, 'admin'],
    [correoLectura, 'lectura'],
    [correoBloqueo, 'comercial'],
  ]) {
    await crearUsuario(pool, { correo, nombre: rol, rol, contrasena: CONTRASENA });
  }
});
afterAll(async () => {
  await pool.query(`DELETE FROM gestion.usuarios WHERE correo LIKE $1`, [
    `%-${sufijo}@prueba.local`,
  ]);
  await app?.close();
});

async function login(correo, contrasena = CONTRASENA) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { correo, contrasena },
  });
  const cookie = res.cookies.find((c) => c.name === 'eco_sesion');
  return { res, cookie, cookies: cookie ? { eco_sesion: cookie.value } : {} };
}

describe('integración: autenticación', () => {
  it('inicia sesión con cookie httpOnly, SameSite=Strict y limitada a /api', async () => {
    const { res, cookie } = await login(correoAdmin.toUpperCase());
    expect(res.statusCode).toBe(200);
    expect(res.json().usuario).toMatchObject({ correo: correoAdmin, rol: 'admin' });
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api' });
    expect(res.body).not.toContain(cookie.value);
  });

  it('recupera la sesión y cierra sesión invalidando el token', async () => {
    const { cookies, res } = await login(correoAdmin);
    const { csrfToken } = res.json();

    const sesion = await app.inject({ url: '/api/auth/sesion', cookies });
    expect(sesion.json().csrfToken).toBe(csrfToken);

    const salida = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies,
      headers: { 'x-csrf-token': csrfToken },
    });
    expect(salida.statusCode).toBe(204);
    expect((await app.inject({ url: '/api/auth/sesion', cookies })).statusCode).toBe(401);
  });

  it('el admin lista usuarios y el rol lectura recibe 403', async () => {
    const admin = await login(correoAdmin);
    const lista = await app.inject({ url: '/api/usuarios', cookies: admin.cookies });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().map((u) => u.correo)).toContain(correoLectura);
    expect(lista.body).not.toContain('hash');

    const lectura = await login(correoLectura);
    expect((await app.inject({ url: '/api/usuarios', cookies: lectura.cookies })).statusCode).toBe(
      403,
    );
  });

  it('bloquea la cuenta tras los intentos fallidos configurados', async () => {
    const { LOGIN_MAX_INTENTOS } = cargarEnv();
    for (let i = 0; i < LOGIN_MAX_INTENTOS; i++) {
      expect((await login(correoBloqueo, 'incorrecta')).res.statusCode).toBe(401);
    }
    // Bloqueada: ni la contraseña correcta entra.
    expect((await login(correoBloqueo)).res.statusCode).toBe(401);
    const { rows } = await pool.query(
      `SELECT bloqueado_hasta > now() AS bloqueado FROM gestion.usuarios WHERE correo = $1`,
      [correoBloqueo],
    );
    expect(rows[0].bloqueado).toBe(true);
  });

  it('el admin restablece la contraseña y eso desbloquea la cuenta', async () => {
    const admin = await login(correoAdmin);
    const { rows } = await pool.query(`SELECT id FROM gestion.usuarios WHERE correo = $1`, [
      correoBloqueo,
    ]);
    const nueva = 'otra-contrasena-segura';
    const res = await app.inject({
      method: 'POST',
      url: `/api/usuarios/${rows[0].id}/contrasena`,
      cookies: admin.cookies,
      headers: { 'x-csrf-token': admin.res.json().csrfToken },
      payload: { contrasena: nueva },
    });
    expect(res.statusCode).toBe(204);
    expect((await login(correoBloqueo, nueva)).res.statusCode).toBe(200);
  });

  it('desactivar un usuario corta su sesión activa', async () => {
    const admin = await login(correoAdmin);
    const lectura = await login(correoLectura);
    const id = lectura.res.json().usuario.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/usuarios/${id}`,
      cookies: admin.cookies,
      headers: { 'x-csrf-token': admin.res.json().csrfToken },
      payload: { activo: false },
    });
    expect(res.json().activo).toBe(false);
    expect(
      (await app.inject({ url: '/api/auth/sesion', cookies: lectura.cookies })).statusCode,
    ).toBe(401);
  });
});
