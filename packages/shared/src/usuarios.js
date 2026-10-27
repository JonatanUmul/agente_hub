import { z } from 'zod';
import { esquemaContrasenaNueva, esquemaCorreo } from './auth.js';
import { esquemaRol } from './roles.js';

const esquemaNombre = z.string().trim().min(1, 'Requerido').max(120);

export const esquemaCrearUsuario = z.object({
  correo: esquemaCorreo,
  nombre: esquemaNombre,
  rol: esquemaRol,
  contrasena: esquemaContrasenaNueva,
});

export const esquemaEditarUsuario = z
  .object({ nombre: esquemaNombre, rol: esquemaRol, activo: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'No hay cambios');

export const esquemaRestablecerContrasena = z.object({ contrasena: esquemaContrasenaNueva });
