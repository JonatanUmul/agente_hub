import { describe, expect, it } from 'vitest';
import { hayCambios } from './edicion.js';

describe('hayCambios', () => {
  it('compara listas por contenido', () => {
    expect(hayCambios({ l: ['a'] }, { l: ['a'] }, ['l'])).toBe(false);
    expect(hayCambios({ l: ['a'] }, { l: ['a', 'b'] }, ['l'])).toBe(true);
  });

  it('compara fechas como instantes solo en los campos de fecha', () => {
    const actual = { d: '2026-11-01T06:00:00.000Z', n: '2024' };
    expect(
      hayCambios(actual, { ...actual, d: '2026-11-01T00:00:00-06:00' }, ['d', 'n'], ['d']),
    ).toBe(false);
    // Un texto que parece fecha no se normaliza si no es campo de fecha.
    expect(hayCambios(actual, { ...actual, n: '2024-01-01T00:00:00Z' }, ['d', 'n'], ['d'])).toBe(
      true,
    );
  });

  it('distingue null de fecha', () => {
    expect(hayCambios({ d: null }, { d: '2026-11-01T06:00:00Z' }, ['d'], ['d'])).toBe(true);
  });

  it('ignora campos que no están en la lista', () => {
    expect(hayCambios({ version: 'a' }, { version: 'b' }, ['otro'])).toBe(false);
  });
});
