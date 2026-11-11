import { describe, expect, it } from 'vitest';
import { esquemaCrearProducto, mencionaCodigo } from './productos.js';

describe('mencionaCodigo', () => {
  it('encuentra el código como palabra completa, sin importar mayúsculas', () => {
    expect(mencionaCodigo('Precio: [[PRECIO:LLAVE]].', 'LLAVE')).toBe(true);
    expect(mencionaCodigo('Ofrece la llave.', 'LLAVE')).toBe(true);
    expect(mencionaCodigo('Ofrece la LLAVE-2', 'LLAVE')).toBe(false);
    expect(mencionaCodigo('LLAVEROS', 'LLAVE')).toBe(false);
    expect(mencionaCodigo('Usa A.B.C', 'A.B')).toBe(false);
    expect(mencionaCodigo(null, 'LLAVE')).toBe(false);
  });
});

describe('esquemaCrearProducto', () => {
  const nuevo = {
    codigo: 'ceramica-flor-azul',
    nombre: 'Ecofiltro Cerámica Flor Azul',
    tipo: 'equipo',
    familia: 'CERAMICA',
    capacidadLitros: null,
    variante: 'Flor Azul',
    nombreCorto: 'Cerámica Flor Azul',
    precioBase: 450,
    descuentoPct: 0,
    estado: 'disponible',
    colores: [],
    palabrasClave: [],
    pautaIds: [],
    orden: 100,
    activo: true,
    descripcionCorta: null,
    descripcion: null,
    caracteristicas: [],
    material: null,
    capacidadTexto: null,
    capacidadPurificadorLitros: null,
    tasaFiltrado: null,
    anchoCm: null,
    altoCm: null,
    largoCm: null,
    pesoLb: null,
    compatibleCon: null,
    urlWeb: null,
    pistasVisuales: null,
    fotosReferencia: [],
  };
  const resultado = (cambio) => esquemaCrearProducto.safeParse({ ...nuevo, ...cambio });

  it('acepta un producto completo y normaliza el ItemCode', () => {
    expect(resultado({}).data.codigo).toBe('CERAMICA-FLOR-AZUL');
  });

  it('exige código, nombre, tipo y familia', () => {
    for (const campo of ['codigo', 'nombre', 'familia']) {
      expect(resultado({ [campo]: '' }).success).toBe(false);
    }
    expect(resultado({ tipo: 'otro' }).success).toBe(false);
  });

  it('exige precio salvo que el producto sea descontinuado', () => {
    const sinPrecio = resultado({ precioBase: null });
    expect(sinPrecio.success).toBe(false);
    expect(sinPrecio.error.issues[0].path).toEqual(['precioBase']);
    expect(resultado({ precioBase: null, estado: 'descontinuado' }).success).toBe(true);
  });
});
