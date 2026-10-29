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

// Parámetros enteros (max_fotos_pauta…): el valor se guarda como texto; si no es un entero llega null.
function aParametro(fila) {
  const texto = fila.valor?.trim() ?? '';
  return {
    clave: fila.clave,
    valor: /^-?\d+$/.test(texto) ? Number(texto) : null,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

export async function listarParametros(db, claves, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT clave, valor, actualizado_en, actualizado_por, actualizado_en::text AS version
     FROM eco_configuracion WHERE clave = ANY($1::text[]) ORDER BY clave${bloquear ? ' FOR UPDATE' : ''}`,
    [claves],
  );
  return rows.map(aParametro);
}

export async function actualizarParametro(db, { clave, valor, actualizadoPor }) {
  await db.query(`UPDATE eco_configuracion SET valor = $2, actualizado_por = $3 WHERE clave = $1`, [
    clave,
    String(valor),
    actualizadoPor,
  ]);
}
