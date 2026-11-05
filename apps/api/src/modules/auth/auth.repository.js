// SQL del login y de gestion.sesiones. Cada sesión tiene su fila en gestion.historial_sesiones
// (entrada, última actividad, salida y motivo), que se conserva cuando la sesión se borra.

// Incluye datos que nunca salen de la API (hash, intentos). `bloqueado` lo calcula la base
// con su propio reloj, así no dependemos de que la hora del servidor de la API coincida.
export async function buscarParaLogin(db, correo) {
  const { rows } = await db.query(
    `SELECT id, hash_contrasena, activo,
            (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > now()) AS bloqueado
     FROM gestion.usuarios WHERE correo = $1`,
    [correo],
  );
  return rows[0] ?? null;
}

// Suma un fallo; al llegar al máximo bloquea y reinicia el contador (el siguiente ciclo empieza de cero).
// Las dos expresiones del SET leen el valor anterior de intentos_fallidos. Devuelve true si este fallo bloqueó.
export async function registrarIntentoFallido(db, id, { maxIntentos, minutosBloqueo }) {
  const { rows } = await db.query(
    `UPDATE gestion.usuarios
     SET intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0 ELSE intentos_fallidos + 1 END,
         bloqueado_hasta   = CASE WHEN intentos_fallidos + 1 >= $2
                                  THEN now() + make_interval(mins => $3) ELSE bloqueado_hasta END
     WHERE id = $1
     RETURNING intentos_fallidos = 0 AS bloqueo`,
    [id, maxIntentos, minutosBloqueo],
  );
  return rows[0]?.bloqueo ?? false;
}

export async function registrarAccesoExitoso(db, id) {
  await db.query(
    `UPDATE gestion.usuarios
     SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = now()
     WHERE id = $1`,
    [id],
  );
}

export async function crearSesion(db, { tokenHash, usuarioId, csrfToken, horas, ip, navegador }) {
  await db.query(
    `WITH h AS (
       INSERT INTO gestion.historial_sesiones (usuario_id, ip, navegador)
       VALUES ($2, $5, $6) RETURNING id
     )
     INSERT INTO gestion.sesiones (token_hash, usuario_id, csrf_token, expira_en, historial_id)
     SELECT $1, $2, $3, now() + make_interval(hours => $4), id FROM h`,
    [tokenHash, usuarioId, csrfToken, horas, ip ?? null, navegador ?? null],
  );
}

// Sesión válida = no vencida y de un usuario activo. El rol se lee en cada petición,
// así un cambio de rol aplica de inmediato sin cerrar la sesión.
export async function buscarSesionVigente(db, tokenHash) {
  const { rows } = await db.query(
    `SELECT s.csrf_token, s.historial_id, u.id, u.correo, u.nombre, u.rol
     FROM gestion.sesiones s
     JOIN gestion.usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = $1 AND s.expira_en > now() AND u.activo`,
    [tokenHash],
  );
  if (!rows[0]) return null;
  const { csrf_token: csrfToken, historial_id: historialId, ...usuario } = rows[0];
  return { csrfToken, historialId: historialId === null ? null : Number(historialId), usuario };
}

// A lo sumo una escritura por minuto y sesión: la última actividad no necesita más precisión.
export async function marcarActividad(db, historialId) {
  await db.query(
    `UPDATE gestion.historial_sesiones SET ultima_actividad = now()
     WHERE id = $1 AND fin IS NULL AND ultima_actividad < now() - interval '1 minute'`,
    [historialId],
  );
}

// Borra sesiones y anota en el historial cuándo y por qué terminaron.
// `condicion` usa los parámetros de `valores`; el motivo va al final. Las vencidas terminan en su última actividad.
async function borrarSesiones(db, condicion, valores, motivo) {
  const m = `$${valores.length + 1}::text`;
  await db.query(
    `WITH borradas AS (
       DELETE FROM gestion.sesiones WHERE ${condicion} RETURNING historial_id
     )
     UPDATE gestion.historial_sesiones
     SET fin = CASE WHEN ${m} = 'expirada' THEN ultima_actividad ELSE now() END, motivo_fin = ${m}
     WHERE id IN (SELECT historial_id FROM borradas) AND fin IS NULL`,
    [...valores, motivo],
  );
}

export const eliminarSesion = (db, tokenHash) =>
  borrarSesiones(db, 'token_hash = $1', [tokenHash], 'salida');

// `excepto` (hash de un token) permite cerrar las demás sesiones y conservar la actual.
export const eliminarSesionesDeUsuario = (db, usuarioId, { motivo, excepto = null }) =>
  borrarSesiones(
    db,
    'usuario_id = $1 AND ($2::text IS NULL OR token_hash <> $2)',
    [usuarioId, excepto],
    motivo,
  );

export const eliminarSesionesVencidas = (db, usuarioId) =>
  borrarSesiones(db, 'usuario_id = $1 AND expira_en <= now()', [usuarioId], 'expirada');
