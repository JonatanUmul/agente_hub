// SQL de gestion.usuarios. Cada función recibe `db` (el pool o un cliente de transacción).

const COLUMNAS = `id, correo, nombre, rol, activo, bloqueado_hasta, ultimo_acceso, creado_en`;

// Fila de PostgreSQL → objeto de la app (camelCase, fechas en ISO).
function aUsuario(fila) {
  return {
    id: fila.id,
    correo: fila.correo,
    nombre: fila.nombre,
    rol: fila.rol,
    activo: fila.activo,
    bloqueadoHasta: fila.bloqueado_hasta?.toISOString() ?? null,
    ultimoAcceso: fila.ultimo_acceso?.toISOString() ?? null,
    creadoEn: fila.creado_en.toISOString(),
  };
}

export async function listar(db) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM gestion.usuarios ORDER BY nombre, id`);
  return rows.map(aUsuario);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM gestion.usuarios WHERE id = $1`, [id]);
  return rows[0] ? aUsuario(rows[0]) : null;
}

export async function obtenerHash(db, id) {
  const { rows } = await db.query(`SELECT hash_contrasena FROM gestion.usuarios WHERE id = $1`, [
    id,
  ]);
  return rows[0]?.hash_contrasena ?? null;
}

export async function insertar(db, { correo, nombre, rol, hashContrasena }) {
  const { rows } = await db.query(
    `INSERT INTO gestion.usuarios (correo, nombre, rol, hash_contrasena)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNAS}`,
    [correo, nombre, rol, hashContrasena],
  );
  return aUsuario(rows[0]);
}

// Solo actualiza los campos presentes. COALESCE mantiene el valor actual cuando llega null.
export async function actualizar(db, id, { nombre, rol, activo }) {
  const { rows } = await db.query(
    `UPDATE gestion.usuarios
     SET nombre = COALESCE($2, nombre),
         rol = COALESCE($3, rol),
         activo = COALESCE($4, activo),
         actualizado_en = now()
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [id, nombre ?? null, rol ?? null, activo ?? null],
  );
  return rows[0] ? aUsuario(rows[0]) : null;
}

// Cambiar la contraseña también desbloquea la cuenta.
export async function actualizarHash(db, id, hashContrasena) {
  const { rowCount } = await db.query(
    `UPDATE gestion.usuarios
     SET hash_contrasena = $2, intentos_fallidos = 0, bloqueado_hasta = NULL, actualizado_en = now()
     WHERE id = $1`,
    [id, hashContrasena],
  );
  return rowCount === 1;
}

// Bloquea las filas de admins activos hasta el fin de la transacción, para que dos cambios
// simultáneos no dejen el sistema sin ningún admin.
export async function idsAdminsActivosBloqueando(db) {
  const { rows } = await db.query(
    `SELECT id FROM gestion.usuarios WHERE rol = 'admin' AND activo FOR UPDATE`,
  );
  return rows.map((fila) => fila.id);
}
