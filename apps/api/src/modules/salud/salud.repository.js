// Consulta mínima: confirma que el pool puede abrir conexión y ejecutar SQL.
export async function pingBaseDatos(db) {
  await db.query('SELECT 1');
}
