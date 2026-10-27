import pg from 'pg';
import { runner } from 'node-pg-migrate';
import { fileURLToPath } from 'node:url';

const DIRECTORIO = fileURLToPath(new URL('../../migrations', import.meta.url));

const conexion = (config) => ({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
});

// Lo normal es que el administrador cree el esquema (docs/sql/crear_rol_eco_app.sql) y eco_app solo
// tenga permiso dentro de él. Si no existe y el usuario puede crearlo (p. ej. un superusuario), se crea;
// si no puede, se explica qué falta en vez de dejar un error críptico de PostgreSQL.
async function asegurarEsquema(config) {
  const cliente = new pg.Client(conexion(config));
  await cliente.connect();
  try {
    const { rowCount } = await cliente.query(
      `SELECT 1 FROM pg_namespace WHERE nspname = 'gestion'`,
    );
    if (rowCount) return;
    try {
      await cliente.query('CREATE SCHEMA gestion');
    } catch (error) {
      throw new Error(
        `El esquema "gestion" no existe y ${config.DB_USER} no puede crearlo (${error.message}). ` +
          'Ejecuta docs/sql/crear_rol_eco_app.sql como eco_admin o superusuario.',
        { cause: error },
      );
    }
  } finally {
    await cliente.end();
  }
}

// Las migraciones viven y se registran solo en el esquema gestion: nunca tocan public (eco_* del bot).
export async function migrar(config, { direccion = 'up', cantidad, log = () => {} } = {}) {
  if (direccion === 'up') await asegurarEsquema(config);
  return runner({
    databaseUrl: conexion(config),
    dir: DIRECTORIO,
    direction: direccion,
    count: cantidad ?? (direccion === 'up' ? Infinity : 1),
    schema: 'gestion',
    migrationsSchema: 'gestion',
    migrationsTable: 'migraciones',
    createSchema: false,
    createMigrationsSchema: false,
    checkOrder: true,
    log,
  });
}
