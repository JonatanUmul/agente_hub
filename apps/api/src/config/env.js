import { z } from 'zod';

// Una sola definición de lo que la API necesita para arrancar.
// Si falta algo, preferimos fallar al inicio que a mitad de una petición.
const booleano = (porDefecto) =>
  z
    .enum(['true', 'false'])
    .default(porDefecto)
    .transform((valor) => valor === 'true');

const esquemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.string().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    CORS_ORIGIN: z.url(),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_SSL: booleano('false'),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),

    // Sesión y login.
    COOKIE_SECURE: booleano('true'),
    SESION_TTL_HORAS: z.coerce
      .number()
      .positive()
      .max(24 * 30)
      .default(8),
    LOGIN_MAX_INTENTOS: z.coerce.number().int().positive().default(5),
    LOGIN_BLOQUEO_MINUTOS: z.coerce.number().int().positive().default(15),
    LOGIN_RATE_LIMIT_POR_MINUTO: z.coerce.number().int().positive().default(10),
  })
  // Una cookie sin Secure viaja en texto plano: solo se permite fuera de producción.
  .refine((c) => c.NODE_ENV !== 'production' || c.COOKIE_SECURE, {
    path: ['COOKIE_SECURE'],
    message: 'debe ser true en producción',
  });

export function cargarEnv(fuente = process.env) {
  const resultado = esquemaEnv.safeParse(fuente);
  if (!resultado.success) {
    // Solo nombres de variables y el problema: nunca los valores (podrían ser secretos).
    const problemas = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Variables de entorno inválidas:\n${problemas.join('\n')}`);
  }
  return Object.freeze(resultado.data);
}
