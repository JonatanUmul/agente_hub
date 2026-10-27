import { z } from 'zod';
import { esquemaRol } from './roles.js';

// Los correos se comparan siempre en minúsculas y sin espacios.
export const esquemaCorreo = z.string().trim().toLowerCase().pipe(z.email('Correo no válido'));

// 12 caracteres mínimo: longitud antes que reglas de símbolos (guía NIST 800-63B).
// Máximo 200 para no dejar que alguien mande megas a argon2.
export const esquemaContrasenaNueva = z
  .string()
  .min(12, 'Mínimo 12 caracteres')
  .max(200, 'Máximo 200 caracteres');

export const esquemaLogin = z.object({
  correo: esquemaCorreo,
  contrasena: z.string().min(1, 'Requerida').max(200),
});

export const esquemaCambiarContrasena = z.object({
  actual: z.string().min(1, 'Requerida').max(200),
  nueva: esquemaContrasenaNueva,
});

export const esquemaUsuario = z.object({
  id: z.number().int(),
  correo: z.string(),
  nombre: z.string(),
  rol: esquemaRol,
  activo: z.boolean(),
  bloqueadoHasta: z.iso.datetime({ offset: true }).nullable(),
  ultimoAcceso: z.iso.datetime({ offset: true }).nullable(),
  creadoEn: z.iso.datetime({ offset: true }),
});

// Lo que la web necesita saber de la sesión actual.
export const esquemaSesion = z.object({
  usuario: esquemaUsuario.pick({ id: true, correo: true, nombre: true, rol: true }),
  csrfToken: z.string(),
});
