// SQL del login y de gestion.sesiones.

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
// Las dos expresiones del SET leen el valor anterior de intentos_fallidos.
export async function registrarIntentoFallido(db, id, { maxIntentos, minutosBloqueo }) {
  await db.query(
    `UPDATE gestion.usuarios
     SET intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0 ELSE intentos_fallidos + 1 END,
         bloqueado_hasta   = CASE WHEN intentos_fallidos + 1 >= $2
                                  THEN now() + make_interval(mins => $3) ELSE bloqueado_hasta END
     WHERE id = $1`,
    [id, maxIntentos, minutosBloqueo],
  );
}

export async function registrarAccesoExitoso(db, id) {
  await db.query(
    `UPDATE gestion.usuarios
     SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = now()
     WHERE id = $1`,
    [id],
  );
}

export async function crearSesion(db, { tokenHash, usuarioId, csrfToken, horas }) {
  await db.query(
    `INSERT INTO gestion.sesiones (token_hash, usuario_id, csrf_token, expira_en)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [tokenHash, usuarioId, csrfToken, horas],
  );
}

// Sesión válida = no vencida y de un usuario activo. El rol se lee en cada petición,
// así un cambio de rol aplica de inmediato sin cerrar la sesión.
export async function buscarSesionVigente(db, tokenHash) {
  const { rows } = await db.query(
    `SELECT s.csrf_token, u.id, u.correo, u.nombre, u.rol
     FROM gestion.sesiones s
     JOIN gestion.usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = $1 AND s.expira_en > now() AND u.activo`,
    [tokenHash],
  );
  if (!rows[0]) return null;
  const { csrf_token: csrfToken, ...usuario } = rows[0];
  return { csrfToken, usuario };
}

export async function eliminarSesion(db, tokenHash) {
  await db.query(`DELETE FROM gestion.sesiones WHERE token_hash = $1`, [tokenHash]);
}

// `exceptoTokenHash` permite cerrar las demás sesiones y conservar la actual.
export async function eliminarSesionesDeUsuario(db, usuarioId, exceptoTokenHash = null) {
  await db.query(
    `DELETE FROM gestion.sesiones
     WHERE usuario_id = $1 AND ($2::text IS NULL OR token_hash <> $2)`,
    [usuarioId, exceptoTokenHash],
  );
}

export async function eliminarSesionesVencidas(db, usuarioId) {
  await db.query(`DELETE FROM gestion.sesiones WHERE usuario_id = $1 AND expira_en <= now()`, [
    usuarioId,
  ]);
}
