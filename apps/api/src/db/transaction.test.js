import { describe, expect, it, vi } from 'vitest';
import { withTransaction } from './transaction.js';

function poolConCliente() {
  const client = { query: vi.fn(async () => ({ rows: [] })), release: vi.fn() };
  return { client, pool: { connect: async () => client } };
}

describe('withTransaction', () => {
  it('hace COMMIT y devuelve el resultado', async () => {
    const { client, pool } = poolConCliente();
    const resultado = await withTransaction(pool, async () => 42);
    expect(resultado).toBe(42);
    expect(client.query.mock.calls.map((c) => c[0])).toEqual(['BEGIN', 'COMMIT']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('hace ROLLBACK, relanza el error y libera el cliente', async () => {
    const { client, pool } = poolConCliente();
    await expect(
      withTransaction(pool, async () => {
        throw new Error('fallo');
      }),
    ).rejects.toThrow('fallo');
    expect(client.query.mock.calls.map((c) => c[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
