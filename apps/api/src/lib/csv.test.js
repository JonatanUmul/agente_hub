import { describe, expect, it } from 'vitest';
import { aCsv } from './csv.js';

const columnas = [
  { titulo: 'Nombre', valor: (f) => f.nombre },
  { titulo: 'Total', valor: (f) => f.total },
];

describe('aCsv', () => {
  it('usa ; como separador, BOM y CRLF', () => {
    expect(aCsv(columnas, [{ nombre: 'Ana', total: 3 }])).toBe('\uFEFFNombre;Total\r\nAna;3\r\n');
  });
  it('entrecomilla y escapa comillas, ; y saltos de línea', () => {
    expect(aCsv(columnas, [{ nombre: 'Dice "hola"; adiós', total: null }])).toContain(
      '"Dice ""hola""; adiós";',
    );
  });
  it('neutraliza fórmulas (inyección CSV)', () => {
    const csv = aCsv(columnas, [{ nombre: '=HYPERLINK("http://x")', total: '-5' }]);
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).toContain(`;'-5`);
  });
});
