import { api, ApiError, guardarCsrfToken } from '../../lib/api.js';

// Sin sesión no es un error para la web: devuelve null y la app muestra el login.
export async function obtenerSesion() {
  try {
    const sesion = await api('/auth/sesion', { avisar401: false });
    guardarCsrfToken(sesion.csrfToken);
    return sesion;
  } catch (error) {
    if (error instanceof ApiError && error.estadoHttp === 401) return null;
    throw error;
  }
}

export async function iniciarSesion(datos) {
  const sesion = await api('/auth/login', { method: 'POST', body: datos, avisar401: false });
  guardarCsrfToken(sesion.csrfToken);
  return sesion;
}

export async function cerrarSesion() {
  try {
    await api('/auth/logout', { method: 'POST', avisar401: false });
  } finally {
    guardarCsrfToken(null);
  }
}

export const cambiarContrasena = (datos) =>
  api('/auth/contrasena', { method: 'POST', body: datos });
