import { describe, expect, it } from 'vitest';
import { calcularPrecioFinal, descuentoVigente, precioQueVeElBot } from './precios.js';
import { esquemaEditarProducto } from './productos.js';

describe('calcularPrecioFinal', () => {
  it.each([
    [100, 0, 100],
    [100, 15, 85],
    [1249.99, 10, 1124.99], // 1124.991
    [0.05, 50, 0.03], // 0.025 → la mitad redondea hacia arriba, como PostgreSQL
    [19.99, 33.33, 13.33], // 13.327333
    [99999999.99, 100, 0],
  ])('precio %d con %d%% → %d', (base, pct, esperado) => {
    expect(calcularPrecioFinal(base, pct)).toBe(esperado);
  });

  it('devuelve null sin precio base', () => {
    expect(calcularPrecioFinal(null, 10)).toBeNull();
  });
});

describe('precioQueVeElBot', () => {
  const producto = { activo: true, precioBase: 200, descuentoVigentePct: 25 };

  it('con precios y promociones: precio con descuento', () => {
    expect(
      precioQueVeElBot({ producto, preciosHabilitados: true, promocionesHabilitadas: true }),
    ).toEqual({ visible: true, precio: 150, descuentoPct: 25 });
  });

  it('sin promociones: precio base, sin descuento', () => {
    expect(
      precioQueVeElBot({ producto, preciosHabilitados: true, promocionesHabilitadas: false }),
    ).toEqual({ visible: true, precio: 200, descuentoPct: null });
  });

  it('sin precios: no muestra precio aunque haya promociones', () => {
    expect(
      precioQueVeElBot({ producto, preciosHabilitados: false, promocionesHabilitadas: true })
        .visible,
    ).toBe(false);
  });

  it('producto inactivo: el bot no lo conoce', () => {
    expect(
      precioQueVeElBot({
        producto: { ...producto, activo: false },
        preciosHabilitados: true,
        promocionesHabilitadas: true,
      }).visible,
    ).toBe(false);
  });
});

describe('esquemaEditarProducto', () => {
  const valido = {
    precioBase: 10.5,
    descuentoPct: 0,
    estado: 'disponible',
    colores: [' azul ', 'azul', '', 'rojo'],
    palabrasClave: [],
    pautaIds: [],
    orden: 100,
    activo: true,
    version: 'v',
  };

  it('limpia listas: recorta, quita vacíos y repetidos', () => {
    expect(esquemaEditarProducto.parse(valido).colores).toEqual(['azul', 'rojo']);
  });

  it.each([
    ['descuento > 100', { descuentoPct: 101 }],
    ['descuento negativo', { descuentoPct: -1 }],
    ['precio negativo', { precioBase: -1 }],
    ['3 decimales', { precioBase: 10.555 }],
    ['estado inventado', { estado: 'oferta' }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(esquemaEditarProducto.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });

  it('acepta 0.1 + 0.2 como 2 decimales', () => {
    expect(esquemaEditarProducto.safeParse({ ...valido, precioBase: 0.1 + 0.2 }).success).toBe(
      true,
    );
  });
});

describe('descuentoVigente (igual que eco_v_catalogo)', () => {
  const vigente = (descuentoPct) => ({ vigente: true, descuentoPct });
  const vencida = (descuentoPct) => ({ vigente: false, descuentoPct });

  it('sin pautas usa el descuento del producto', () => {
    expect(descuentoVigente({ descuentoPct: 10, pautas: [] })).toBe(10);
  });
  it('con pautas vigentes usa el mayor entre el propio y todas ellas', () => {
    expect(descuentoVigente({ descuentoPct: 10, pautas: [vigente(25), vigente(35)] })).toBe(35);
    expect(descuentoVigente({ descuentoPct: 40, pautas: [vigente(25)] })).toBe(40);
    expect(descuentoVigente({ descuentoPct: 5, pautas: [vigente(null)] })).toBe(5);
  });
  it('las pautas vencidas no cuentan y el producto conserva su descuento propio', () => {
    expect(descuentoVigente({ descuentoPct: 15, pautas: [vencida(30)] })).toBe(15);
    expect(descuentoVigente({ descuentoPct: 15, pautas: [vencida(50), vigente(20)] })).toBe(20);
  });
});
