import pg from 'pg';

// Un único Pool para toda la API: abrir conexiones por petición agotaría la base del bot.
// `credenciales` permite un pool aparte con otro rol (el de solo lectura de reportes).
export function crearPool(config, credenciales = {}) {
  const pool = new pg.Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: credenciales.user ?? config.DB_USER,
    password: credenciales.password ?? config.DB_PASSWORD,
    ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
    max: credenciales.max ?? config.DB_POOL_MAX,
    application_name: credenciales.nombre ?? 'ecofiltro-gestion',
  });

  // Un cliente inactivo que pierde la conexión emite 'error'; sin este listener el proceso muere.
  pool.on('error', (error) => {
    console.error('Error en conexión inactiva del pool:', error.message);
  });

  return pool;
}

// Pool de reportes: rol de solo lectura, pocas conexiones y cada transacción de solo lectura.
// null si no está configurado (los reportes quedan desactivados).
export function crearPoolReportes(config) {
  if (!config.DB_REPORTES_USER) return null;
  const pool = crearPool(config, {
    user: config.DB_REPORTES_USER,
    password: config.DB_REPORTES_PASSWORD,
    max: 3,
    nombre: 'ecofiltro-gestion-reportes',
  });
  // Defensa adicional al rol: cualquier intento de escribir falla, y ninguna consulta corre más de 15 s.
  pool.on('connect', (cliente) =>
    cliente.query(`SET default_transaction_read_only = on; SET statement_timeout = '15s'`),
  );
  return pool;
}
