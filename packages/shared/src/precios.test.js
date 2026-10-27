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
    pautaId: null,
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
  it('sin pauta usa el descuento del producto', () => {
    expect(descuentoVigente({ descuentoPct: 10, pauta: null })).toBe(10);
  });
  it('con pauta vigente usa el mayor', () => {
    expect(descuentoVigente({ descuentoPct: 10, pauta: { vigente: true, descuentoPct: 25 } })).toBe(
      25,
    );
    expect(descuentoVigente({ descuentoPct: 30, pauta: { vigente: true, descuentoPct: 25 } })).toBe(
      30,
    );
    expect(
      descuentoVigente({ descuentoPct: 5, pauta: { vigente: true, descuentoPct: null } }),
    ).toBe(5);
  });
  it('con pauta vencida o inactiva es 0, aunque el producto tenga descuento', () => {
    expect(
      descuentoVigente({ descuentoPct: 15, pauta: { vigente: false, descuentoPct: 30 } }),
    ).toBe(0);
  });
});
