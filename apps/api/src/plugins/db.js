import fp from 'fastify-plugin';

// Expone el pool como app.db para que los módulos no lo importen directamente
// (en pruebas podemos inyectar uno falso). app.dbReportes: pool de solo lectura de reportes (o null).
async function db(app, { pool, poolReportes = null }) {
  app.decorate('db', pool);
  app.decorate('dbReportes', poolReportes);
  app.addHook('onClose', async () => {
    await pool.end();
    await poolReportes?.end();
  });
}

export default fp(db, { name: 'db' });
