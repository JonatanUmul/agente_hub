# Módulo usuarios

Administración de las personas que usan la app. Todos los endpoints exigen el permiso `usuarios:gestionar` (solo `admin`).

- **Tablas:** `gestion.usuarios`; borra filas de `gestion.sesiones` al desactivar o restablecer contraseña.
- **Endpoints:**
  - `GET /api/usuarios` → lista (nunca incluye el hash).
  - `POST /api/usuarios` `{ correo, nombre, rol, contrasena }` → 201. 409 `CORREO_EN_USO` si el correo existe.
  - `PATCH /api/usuarios/:id` `{ nombre?, rol?, activo? }` → usuario actualizado.
  - `POST /api/usuarios/:id/contrasena` `{ contrasena }` → 204. Desbloquea y cierra sus sesiones.
- **Reglas:**
  - No se borra a nadie: se desactiva. Desactivar corta sus sesiones al instante.
  - Siempre queda al menos un admin activo (409 `ULTIMO_ADMIN`), verificado con `FOR UPDATE` dentro de una transacción.
  - Nadie se desactiva a sí mismo (409 `NO_AUTODESACTIVAR`).
  - Un cambio de rol aplica en la siguiente petición: el rol se lee de la base en cada request.
- **Primer admin:** `npm run crear-admin` (pide los datos por consola, la contraseña sin mostrarse).
