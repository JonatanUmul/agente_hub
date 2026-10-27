import { z } from 'zod';

// Roles de la app (no de PostgreSQL). Los permisos se verifican en la API.
export const ROLES = ['admin', 'comercial', 'contenido', 'lectura'];
export const esquemaRol = z.enum(ROLES);
