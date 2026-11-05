# Módulo accesos

Control de usuarios de la app: cuándo entra y sale cada uno, intentos fallidos y cambios hechos por un admin.
Solo `admin` (`usuarios:gestionar`).

- **Tablas:** `gestion.historial_sesiones` (una fila por sesión), `gestion.eventos_usuarios`. Las escriben `auth`
  (login, logout, fallos, bloqueos, cambio de contraseña) y `usuarios` (crear, editar, activar, restablecer, cerrar sesiones).
- **Endpoint:** `GET /api/accesos?desde&hasta&usuarioId` → `{ resumen, sesiones, eventos }` (máximo 500 de cada uno).
- **Entrada / salida:**
  - Entrada = login correcto. Guarda IP y navegador.
  - Salida = cierre de sesión, o la última actividad si la sesión venció sin cerrarla («Dejó la app abierta»).
  - La última actividad se actualiza con cualquier petición, a lo sumo una vez por minuto. Mientras la app está
    abierta hace consultas periódicas, así que cuenta como actividad.
  - «En línea» = sesión abierta con actividad en los últimos `MINUTOS_EN_LINEA` (5).
- **Fechas:** hora de Guatemala. Una sesión entra en el rango si se cruza con él.
