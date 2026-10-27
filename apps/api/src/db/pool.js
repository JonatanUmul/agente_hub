import pg from 'pg';

// Un único Pool para toda la API: abrir conexiones por petición agotaría la base del bot.
export function crearPool(config) {
  const pool = new pg.Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
    max: config.DB_POOL_MAX,
    application_name: 'ecofiltro-gestion',
  });

  // Un cliente inactivo que pierde la conexión emite 'error'; sin este listener el proceso muere.
  pool.on('error', (error) => {
    console.error('Error en conexión inactiva del pool:', error.message);
  });

  return pool;
}
