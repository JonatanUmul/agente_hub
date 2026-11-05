import { esquemaCambiarContrasena, esquemaLogin, esquemaSesion } from '@ecofiltro/shared';
import { NOMBRE_COOKIE, opcionesCookie } from './cookie.js';
import * as servicio from './auth.service.js';

// IP y navegador para el control de accesos (el user-agent se recorta: lo manda el cliente).
export const origenDe = (request) => ({
  ip: request.ip,
  navegador: request.headers['user-agent']?.slice(0, 300) ?? null,
});

export async function rutasAuth(app) {
  const { config } = app;

  app.post(
    '/auth/login',
    {
      config: {
        publica: true,
        rateLimit: { max: config.LOGIN_RATE_LIMIT_POR_MINUTO, timeWindow: '1 minute' },
      },
      schema: { body: esquemaLogin, response: { 200: esquemaSesion } },
    },
    async (request, reply) => {
      const { token, usuario, csrfToken } = await servicio.iniciarSesion(
        app.db,
        config,
        request.body,
        origenDe(request),
      );
      reply.setCookie(NOMBRE_COOKIE, token, opcionesCookie(config));
      return { usuario, csrfToken };
    },
  );

  // La web la consulta al cargar: si hay sesión, recupera el usuario y el token CSRF.
  app.get('/auth/sesion', { schema: { response: { 200: esquemaSesion } } }, async (request) => ({
    usuario: request.usuario,
    csrfToken: request.csrfToken,
  }));

  app.post('/auth/logout', async (request, reply) => {
    await servicio.cerrarSesion(app.db, request.tokenSesion);
    const { maxAge: _maxAge, ...opciones } = opcionesCookie(config);
    return reply.clearCookie(NOMBRE_COOKIE, opciones).code(204).send();
  });

  app.post(
    '/auth/contrasena',
    { schema: { body: esquemaCambiarContrasena } },
    async (request, reply) => {
      await servicio.cambiarContrasenaPropia(app.db, {
        usuario: request.usuario,
        token: request.tokenSesion,
        ip: request.ip,
        ...request.body,
      });
      return reply.code(204).send();
    },
  );
}
