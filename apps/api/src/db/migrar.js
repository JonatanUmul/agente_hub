import { runner } from 'node-pg-migrate';
import { fileURLToPath } from 'node:url';

const DIRECTORIO = fileURLToPath(new URL('../../migrations', import.meta.url));

// Las migraciones viven y se registran solo en el esquema gestion: nunca tocan public (eco_* del bot).
// createSchema: false porque el esquema lo crea el administrador (docs/sql/crear_rol_eco_app.sql).
export function migrar(config, { direccion = 'up', cantidad, log = () => {} } = {}) {
  return runner({
    databaseUrl: {
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
    },
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
