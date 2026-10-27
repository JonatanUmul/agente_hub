// Ejecuta la misma función que usa el bot en cada mensaje.
export async function obtener(db, modulo) {
  const { rows } = await db.query(`SELECT eco_contexto($1) AS contexto`, [modulo]);
  return rows[0].contexto;
}
