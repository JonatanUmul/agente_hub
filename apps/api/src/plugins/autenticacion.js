import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { tienePermiso } from '@ecofiltro/shared';
import { AppError } from '../lib/app-error.js';
import { sonIguales } from '../lib/tokens.js';
import { NOMBRE_COOKIE } from '../modules/auth/cookie.js';
import { obtenerSesion } from '../modules/auth/auth.service.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Toda ruta bajo /api está protegida salvo que declare `config: { publica: true }`.
// Una ruta sin `config.permiso` exige solo 'ver' (cualquier usuario con sesión).
// Así, olvidar declarar algo deja la ruta cerrada, nunca abierta.
async function autenticacion(app) {
  await app.register(cookie);
  app.decorateRequest('usuario', null);
  app.decorateRequest('tokenSesion', null);
  app.decorateRequest('csrfToken', null);

  app.addHook('onRequest', async (request) => {
    const opciones = request.routeOptions.config ?? {};
    if (opciones.publica) return;

    const token = request.cookies[NOMBRE_COOKIE];
    const sesion = await obtenerSesion(app.db, token);
    if (!sesion) {
      throw new AppError({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Inicia sesión para continuar',
        estadoHttp: 401,
      });
    }
    request.usuario = sesion.usuario;
    request.tokenSesion = token;
    request.csrfToken = sesion.csrfToken;

    // Token CSRF: la web lo recibe al iniciar sesión y lo reenvía en una cabecera.
    // Otro sitio no puede leerlo, así que no puede fabricar una petición válida.
    if (
      !METODOS_SEGUROS.has(request.method) &&
      !sonIguales(request.headers['x-csrf-token'], sesion.csrfToken)
    ) {
      throw new AppError({
        codigo: 'CSRF_INVALIDO',
        mensaje: 'La sesión no es válida para esta acción. Recarga la página.',
        estadoHttp: 403,
      });
    }

    if (!tienePermiso(sesion.usuario.rol, opciones.permiso ?? 'ver')) {
      throw new AppError({
        codigo: 'SIN_PERMISO',
        mensaje: 'No tienes permiso para esta acción',
        estadoHttp: 403,
      });
    }
  });
}

export default fp(autenticacion, { name: 'autenticacion', dependencies: ['db'] });
