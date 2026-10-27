import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from './preguntas.repository.js';
import { crearPregunta } from './preguntas.service.js';

vi.mock('./preguntas.repository.js');

const db = { connect: async () => ({ query: async () => {}, release: () => {} }) };
beforeEach(() => vi.resetAllMocks());

describe('crearPregunta', () => {
  it('traduce número duplicado a 409 indicando el número', async () => {
    repo.insertar.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(
      crearPregunta(db, { datos: { numero: 7 }, correo: 'c@e.com' }),
    ).rejects.toMatchObject({
      codigo: 'NUMERO_EN_USO',
      estadoHttp: 409,
      message: expect.stringContaining('7'),
    });
  });
});
