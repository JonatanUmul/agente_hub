import { describe, expect, it } from 'vitest';
import { imagenesNoUsadas, loQueRecibeElCliente } from './artePauta.js';
import { errorParametro } from './configuracion.js';

const a = (id, extra = {}) => ({
  id,
  tipo: 'imagen',
  producto: null,
  pautaIdPrincipal: 5,
  pautas: [{ id: 5 }],
  orden: id * 10,
  activo: true,
  ...extra,
});
const foto = (id, extra = {}) => a(id, { producto: { id: 1, nombre: 'Tonelito' }, ...extra });

describe('loQueRecibeElCliente', () => {
  it('con arte envía solo los artes activos, hasta 3, por orden', () => {
    const r = loQueRecibeElCliente(
      [foto(1), a(5), a(2), a(3), a(4), a(6, { activo: false })],
      5,
      1,
    );
    expect(r.conArte).toBe(true);
    expect(r.imagenes.map((x) => x.id)).toEqual([2, 3, 4]);
    expect(r.artesActivos).toBe(4);
  });

  it('sin arte envía hasta max_fotos_pauta fotos de producto', () => {
    const archivos = [foto(3), foto(1), foto(2), a(4, { activo: false })];
    expect(loQueRecibeElCliente(archivos, 5, 1).imagenes.map((x) => x.id)).toEqual([1]);
    expect(loQueRecibeElCliente(archivos, 5, 2).imagenes.map((x) => x.id)).toEqual([1, 2]);
    expect(loQueRecibeElCliente(archivos, 5, 0).imagenes).toEqual([]);
  });

  it('usa la pauta principal (pauta_id) y no cuenta videos', () => {
    const archivos = [
      a(1, { pautaIdPrincipal: 7, pautas: [{ id: 5 }, { id: 7 }] }),
      a(2, { tipo: 'video' }),
    ];
    expect(loQueRecibeElCliente(archivos, 5, 1).conArte).toBe(false);
    expect(imagenesNoUsadas(archivos, 5).map((x) => x.id)).toEqual([1]);
  });
});

describe('errorParametro', () => {
  it('valida enteros y rangos', () => {
    expect(errorParametro('segundos_agrupar_mensajes', 0)).toBeNull();
    expect(errorParametro('segundos_agrupar_mensajes', 20)).toBeNull();
    expect(errorParametro('segundos_agrupar_mensajes', 21)).toMatch(/entre 0 y 20/);
    expect(errorParametro('max_fotos_pauta', 1.5)).toBe('Debe ser entero');
  });
});
