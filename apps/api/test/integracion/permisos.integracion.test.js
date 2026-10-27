import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cargarEnv } from '../../src/config/env.js';
import { crearPool } from '../../src/db/pool.js';

// Verifica que docs/sql/crear_rol_eco_app.sql da a eco_app exactamente lo que la app necesita.
// Todo corre en una transacción que se revierte: la base queda igual.
let pool;
let client;
beforeAll(async () => {
  pool = crearPool(cargarEnv());
  client = await pool.connect();
});
afterAll(async () => {
  client?.release();
  await pool?.end();
});

async function enTransaccionRevertida(fn) {
  await client.query('BEGIN');
  try {
    return await fn();
  } finally {
    await client.query('ROLLBACK');
  }
}

describe('integración: permisos de eco_app', () => {
  it('conecta como eco_app', async () => {
    const { rows } = await client.query('SELECT current_user AS usuario');
    expect(rows[0].usuario).toBe('eco_app');
  });

  it('inserta y actualiza un producto, y el trigger registra la auditoría', async () => {
    await enTransaccionRevertida(async () => {
      const { rows } = await client.query(
        `INSERT INTO eco_productos (codigo, nombre, tipo, familia, actualizado_por)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ['PRUEBA-1', 'Producto de prueba', 'equipo', 'prueba', 'qa@ejemplo.com'],
      );
      const id = rows[0].id;
      await client.query('UPDATE eco_productos SET precio_base = $1 WHERE id = $2', [100, id]);

      const auditoria = await client.query(
        `SELECT operacion, usuario_db, despues->>'actualizado_por' AS actualizado_por
         FROM eco_auditoria WHERE tabla = 'eco_productos' AND registro_id = $1 ORDER BY id`,
        [String(id)],
      );
      expect(auditoria.rows).toEqual([
        { operacion: 'INSERT', usuario_db: 'eco_app', actualizado_por: 'qa@ejemplo.com' },
        { operacion: 'UPDATE', usuario_db: 'eco_app', actualizado_por: 'qa@ejemplo.com' },
      ]);
    });
  });

  it('no puede borrar contenido ni alterar la auditoría', async () => {
    for (const sql of [
      'DELETE FROM eco_productos',
      'DELETE FROM eco_auditoria',
      'UPDATE eco_auditoria SET tabla = $1',
    ]) {
      await enTransaccionRevertida(async () => {
        await expect(client.query(sql, sql.includes('$1') ? ['x'] : [])).rejects.toThrow(
          /permission denied/,
        );
      });
    }
  });

  it('ejecuta eco_contexto y es dueño del esquema gestion', async () => {
    const contexto = await client.query(`SELECT eco_contexto('SAC') AS c`);
    expect(contexto.rows[0].c.modulo).toBe('SAC');

    const esquema = await client.query(
      `SELECT pg_get_userbyid(nspowner) AS dueno FROM pg_namespace WHERE nspname = 'gestion'`,
    );
    expect(esquema.rows[0].dueno).toBe('eco_app');
  });
});
