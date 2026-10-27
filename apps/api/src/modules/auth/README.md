# Módulo auth

Inicio y cierre de sesión, sesión actual y cambio de la propia contraseña.

- **Tablas:** `gestion.sesiones` (lectura/escritura), `gestion.usuarios` (intentos fallidos, bloqueo, último acceso, hash).
- **Endpoints:**
  - `POST /api/auth/login` (público, rate limit `LOGIN_RATE_LIMIT_POR_MINUTO` por IP) → `{ usuario, csrfToken }` + cookie `eco_sesion`.
  - `GET /api/auth/sesion` → `{ usuario, csrfToken }` o 401.
  - `POST /api/auth/logout` → 204, borra la sesión y la cookie.
  - `POST /api/auth/contrasena` `{ actual, nueva }` → 204, cierra las demás sesiones.

## Cómo funciona la sesión

1. Login correcto → token aleatorio de 256 bits. La cookie lleva el token; la base guarda **solo su SHA-256**.
2. Cookie `httpOnly`, `SameSite=Strict`, `path=/api`, `Secure` (obligatorio en producción), vence en `SESION_TTL_HORAS`.
3. Cada petición: `plugins/autenticacion.js` busca la sesión, verifica CSRF en métodos que modifican
   (cabecera `x-csrf-token`) y el permiso de la ruta (`config.permiso`, por defecto `ver`).

## Bloqueo

`LOGIN_MAX_INTENTOS` fallos seguidos bloquean la cuenta `LOGIN_BLOQUEO_MINUTOS`. Correo inexistente, contraseña
incorrecta, cuenta inactiva o bloqueada responden **igual** (401 `CREDENCIALES_INVALIDAS`) y tardan lo mismo, para
no revelar qué correos existen. Un admin desbloquea restableciendo la contraseña.
