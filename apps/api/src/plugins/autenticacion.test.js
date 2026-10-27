import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAppPrueba } from '../../test/helpers.js';
import { obtenerSesion } from '../modules/auth/auth.service.js';

vi.mock('../modules/auth/auth.service.js', async (original) => ({
  ...(await original()),
  obtenerSesion: vi.fn(),
}));

let app;
afterEach(() => app?.close());
beforeEach(() => vi.resetAllMocks());

const sesionCon = (rol) => ({
  usuario: { id: 1, correo: 'x@ejemplo.com', nombre: 'X', rol },
  csrfToken: 'token-csrf',
});

// Rutas de prueba: una de lectura, una que escribe y una que exige un permiso concreto.
function registrar(api) {
  api.get('/leer', async () => ({ ok: true }));
  api.post('/escribir', async () => ({ ok: true }));
  api.post('/solo-contenido', { config: { permiso: 'reglas:editar' } }, async () => ({ ok: true }));
}
const cookie = { eco_sesion: 'abc' };

describe('plugin de autenticación', () => {
  it('rechaza con 401 si no hay sesión', async () => {
    obtenerSesion.mockResolvedValue(null);
    app = await crearAppPrueba({ registrar });
    const res = await app.inject({ url: '/api/leer' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.codigo).toBe('NO_AUTENTICADO');
  });

  it('permite leer a cualquier rol con sesión', async () => {
    obtenerSesion.mockResolvedValue(sesionCon('lectura'));
    app = await crearAppPrueba({ registrar });
    const res = await app.inject({ url: '/api/leer', cookies: cookie });
    expect(res.statusCode).toBe(200);
  });

  it('exige el token CSRF en métodos que modifican', async () => {
    obtenerSesion.mockResolvedValue(sesionCon('admin'));
    app = await crearAppPrueba({ registrar });
    const sinToken = await app.inject({ method: 'POST', url: '/api/escribir', cookies: cookie });
    expect(sinToken.statusCode).toBe(403);
    expect(sinToken.json().error.codigo).toBe('CSRF_INVALIDO');

    const conToken = await app.inject({
      method: 'POST',
      url: '/api/escribir',
      cookies: cookie,
      headers: { 'x-csrf-token': 'token-csrf' },
    });
    expect(conToken.statusCode).toBe(200);
  });

  it('verifica el permiso de la ruta según el rol', async () => {
    const pedir = () =>
      app.inject({
        method: 'POST',
        url: '/api/solo-contenido',
        cookies: cookie,
        headers: { 'x-csrf-token': 'token-csrf' },
      });

    obtenerSesion.mockResolvedValue(sesionCon('comercial'));
    app = await crearAppPrueba({ registrar });
    expect((await pedir()).json().error.codigo).toBe('SIN_PERMISO');

    obtenerSesion.mockResolvedValue(sesionCon('contenido'));
    expect((await pedir()).statusCode).toBe(200);
  });

  it('las rutas de usuarios son solo para admin', async () => {
    obtenerSesion.mockResolvedValue(sesionCon('comercial'));
    app = await crearAppPrueba();
    const res = await app.inject({ url: '/api/usuarios', cookies: cookie });
    expect(res.statusCode).toBe(403);
  });
});

describe('rate limit del login', () => {
  it('responde 429 al superar el límite por minuto', async () => {
    app = await crearAppPrueba({ config: { LOGIN_RATE_LIMIT_POR_MINUTO: '2' } });
    const intento = () =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { correo: 'nadie@ejemplo.com', contrasena: 'x' },
      });
    expect((await intento()).statusCode).toBe(401);
    expect((await intento()).statusCode).toBe(401);
    const bloqueado = await intento();
    expect(bloqueado.statusCode).toBe(429);
    expect(bloqueado.json().error.codigo).toBe('DEMASIADAS_SOLICITUDES');
  });
});

describe('IP del cliente detrás de proxies', () => {
  // Con 1 salto de confianza, la IP es la que agregó nuestro proxy (la última de la lista);
  // lo que el cliente escriba antes en X-Forwarded-For no cuenta.
  it('no deja que el cliente invente su IP para saltarse el rate limit', async () => {
    app = await crearAppPrueba({
      config: { LOGIN_RATE_LIMIT_POR_MINUTO: '1', TRUST_PROXY_SALTOS: '1' },
    });
    const intento = (ipFalsa) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '10.0.0.2',
        headers: { 'x-forwarded-for': `${ipFalsa}, 203.0.113.7` },
        payload: { correo: 'nadie@ejemplo.com', contrasena: 'x' },
      });
    expect((await intento('1.1.1.1')).statusCode).toBe(401);
    expect((await intento('2.2.2.2')).statusCode).toBe(429);
  });
});
