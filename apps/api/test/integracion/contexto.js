import pg from 'pg';
import { crearApp } from '../../src/app.js';
import { cargarEnv } from '../../src/config/env.js';
import { crearPool } from '../../src/db/pool.js';
import { crearUsuario } from '../../src/modules/usuarios/usuarios.service.js';

export const CONTRASENA_PRUEBA = 'contrasena-de-prueba-123';

// App real contra la base de Docker + utilidades para crear usuarios y hacer login.
// `poolAdmin` usa el superusuario del contenedor SOLO para limpiar lo que eco_app no puede borrar.
export async function crearContexto() {
  const config = cargarEnv({ ...process.env, LOGIN_RATE_LIMIT_POR_MINUTO: '1000' });
  const pool = crearPool(config);
  const poolAdmin = new pg.Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: process.env.DEV_PG_SUPERUSER,
    password: process.env.DEV_PG_SUPERPASSWORD,
  });
  const app = await crearApp({ config, pool, logger: false });
  const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

  async function sesionCon(rol) {
    const correo = `${rol}-${sufijo}@prueba.local`;
    await crearUsuario(pool, { correo, nombre: rol, rol, contrasena: CONTRASENA_PRUEBA });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { correo, contrasena: CONTRASENA_PRUEBA },
    });
    const cookie = res.cookies.find((c) => c.name === 'eco_sesion');
    const csrfToken = res.json().csrfToken;
    // Petición autenticada como este usuario.
    const pedir = (opciones) =>
      app.inject({
        ...opciones,
        cookies: { eco_sesion: cookie.value },
        headers: { 'x-csrf-token': csrfToken, ...opciones.headers },
      });
    return { correo, pedir };
  }

  async function cerrar() {
    await pool.query(`DELETE FROM gestion.usuarios WHERE correo LIKE $1`, [
      `%-${sufijo}@prueba.local`,
    ]);
    await app.close();
    await poolAdmin.end();
  }

  return { app, pool, poolAdmin, sufijo, sesionCon, cerrar };
}
