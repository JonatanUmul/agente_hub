// SQL de eco_configuracion. Solo lee y escribe las claves que se le pasan.

function aInterruptor(fila) {
  return {
    clave: fila.clave,
    descripcion: fila.descripcion,
    // Misma interpretación que eco_contexto(): solo 'true' (sin importar mayúsculas) es verdadero.
    habilitado: fila.valor?.toLowerCase() === 'true',
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
  };
}

export async function listarPorClaves(db, claves) {
  const { rows } = await db.query(
    `SELECT clave, valor, descripcion, actualizado_en, actualizado_por
     FROM eco_configuracion WHERE clave = ANY($1::text[]) ORDER BY clave`,
    [claves],
  );
  return rows.map(aInterruptor);
}

// Guardamos exactamente 'true' / 'false', que es lo que eco_contexto() sabe leer.
export async function actualizarBooleano(db, { clave, valor, actualizadoPor }) {
  const { rows } = await db.query(
    `UPDATE eco_configuracion
     SET valor = $2, actualizado_por = $3
     WHERE clave = $1 AND tipo = 'booleano'
     RETURNING clave, valor, descripcion, actualizado_en, actualizado_por`,
    [clave, valor ? 'true' : 'false', actualizadoPor],
  );
  return rows[0] ? aInterruptor(rows[0]) : null;
}

// Claves de texto (p. ej. menu_bienvenida_texto). `version` = actualizado_en para detectar ediciones simultáneas.
export async function leerTexto(db, clave, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT clave, valor, actualizado_en, actualizado_por, actualizado_en::text AS version
     FROM eco_configuracion WHERE clave = $1 AND tipo = 'texto'${bloquear ? ' FOR UPDATE' : ''}`,
    [clave],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    clave: fila.clave,
    texto: fila.valor ?? '',
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

export async function actualizarTexto(db, { clave, texto, actualizadoPor }) {
  await db.query(
    `UPDATE eco_configuracion SET valor = $2, actualizado_por = $3 WHERE clave = $1 AND tipo = 'texto'`,
    [clave, texto, actualizadoPor],
  );
}
