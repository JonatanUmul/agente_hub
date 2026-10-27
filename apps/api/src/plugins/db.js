import fp from 'fastify-plugin';

// Expone el pool como app.db para que los módulos no lo importen directamente
// (en pruebas podemos inyectar uno falso).
async function db(app, { pool }) {
  app.decorate('db', pool);
  app.addHook('onClose', async () => {
    await pool.end();
  });
}

export default fp(db, { name: 'db' });
