// Ejecuta fn(client) dentro de BEGIN/COMMIT. Si fn lanza, hace ROLLBACK y relanza.
// Todas las escrituras en eco_* pasan por aquí para no dejar cambios a medias que el bot lea.
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
