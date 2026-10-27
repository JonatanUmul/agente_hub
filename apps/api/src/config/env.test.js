import { describe, expect, it } from 'vitest';
import { cargarEnv } from './env.js';

const minimo = {
  CORS_ORIGIN: 'http://localhost:5173',
  DB_HOST: 'localhost',
  DB_NAME: 'ecofiltro_bot',
  DB_USER: 'eco_app',
  DB_PASSWORD: 'secreto-de-prueba',
};

describe('cargarEnv', () => {
  it('aplica valores por defecto y convierte tipos', () => {
    const config = cargarEnv({ ...minimo, DB_PORT: '5433', DB_SSL: 'true' });
    expect(config.DB_PORT).toBe(5433);
    expect(config.DB_SSL).toBe(true);
    expect(config.API_PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
  });

  it('falla indicando qué variable falta', () => {
    const { DB_PASSWORD: _omitida, ...incompleto } = minimo;
    expect(() => cargarEnv(incompleto)).toThrow(/DB_PASSWORD/);
  });

  it('no incluye valores en el mensaje de error', () => {
    expect(() => cargarEnv({ ...minimo, DB_PORT: 'secreto-raro' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secreto-raro') }),
    );
  });
});
