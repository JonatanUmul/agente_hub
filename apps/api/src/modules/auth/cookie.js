export const NOMBRE_COOKIE = 'eco_sesion';

// httpOnly: el JavaScript de la página no puede leerla (protege ante XSS).
// SameSite=Strict: el navegador no la envía en peticiones iniciadas desde otro sitio (protege ante CSRF).
// path=/api: solo viaja a la API, no a los archivos estáticos.
export const opcionesCookie = (config) => ({
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  sameSite: 'strict',
  path: '/api',
  maxAge: Math.round(config.SESION_TTL_HORAS * 3600),
});
