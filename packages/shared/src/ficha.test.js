import { describe, expect, it } from 'vitest';
import {
  camposQueNoAplican,
  contradiccionesFicha,
  faltantesFicha,
  fichaQueVeElBot,
  textoMedidas,
} from './ficha.js';
import { esquemaEditarProducto } from './productos.js';

const fichaVacia = {
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
};
const editable = {
  precioBase: 10,
  descuentoPct: 0,
  estado: 'disponible',
  colores: [],
  palabrasClave: [],
  pautaIds: [],
  orden: 100,
  activo: true,
  ...fichaVacia,
  version: 'v',
};
const valida = (cambio) => esquemaEditarProducto.safeParse({ ...editable, ...cambio }).success;

describe('esquemaEditarProducto: ficha', () => {
  it('acepta la ficha vacía y convierte textos vacíos en null', () => {
    const r = esquemaEditarProducto.parse({ ...editable, descripcion: '  ', urlWeb: '' });
    expect(r).toMatchObject({ descripcion: null, urlWeb: null });
  });

  it.each([
    ['medida negativa', { anchoCm: -1 }],
    ['medida en 0', { altoCm: 0 }],
    ['medida con 2 decimales', { largoCm: 37.55 }],
    ['peso con 2 decimales', { pesoLb: 10.25 }],
    ['URL de otro sitio', { urlWeb: 'https://otra.com/producto' }],
    ['URL sin https', { urlWeb: 'http://ecofiltro.com.gt/tienda' }],
    ['URL que imita el dominio', { urlWeb: 'https://ecofiltro.com.gt.malo.com/' }],
    ['HTML en la descripción', { descripcion: 'Filtro <b>nuevo</b>' }],
    ['entidad HTML', { material: 'Barro&nbsp;cocido' }],
    ['13 características', { caracteristicas: Array.from({ length: 13 }, (_, i) => `Dato ${i}`) }],
    ['característica de 201 caracteres', { caracteristicas: ['x'.repeat(201)] }],
    ['HTML en una característica', { caracteristicas: ['<p>Dato</p>'] }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(valida(cambio)).toBe(false);
  });

  it('acepta valores válidos y un "<" suelto que no es HTML', () => {
    expect(
      valida({
        anchoCm: 37.5,
        pesoLb: 12.3,
        capacidadPurificadorLitros: 1.5,
        urlWeb: 'https://ecofiltro.com.gt/producto/tonelito/',
        descripcion: 'Filtra < 2 litros por hora',
      }),
    ).toBe(true);
  });

  it('limpia características: quita vacías y repetidas, conserva el orden', () => {
    const r = esquemaEditarProducto.parse({ ...editable, caracteristicas: ['b', ' a ', '', 'b'] });
    expect(r.caracteristicas).toEqual(['b', 'a']);
  });
});

describe('camposQueNoAplican', () => {
  it('purificador solo en equipos y repuestos; compatibilidad solo en repuestos y accesorios', () => {
    const datos = { capacidadPurificadorLitros: 10, compatibleCon: 'Tonelito' };
    expect(camposQueNoAplican('equipo', datos)).toEqual(['compatibleCon']);
    expect(camposQueNoAplican('accesorio', datos)).toEqual(['capacidadPurificadorLitros']);
    expect(camposQueNoAplican('repuesto', datos)).toEqual([]);
    expect(camposQueNoAplican('equipo', { compatibleCon: null })).toEqual([]);
  });
});

describe('textoMedidas', () => {
  it('solo incluye las medidas que existen', () => {
    expect(textoMedidas({ anchoCm: 37.5, altoCm: 59, largoCm: null })).toBe(
      'ancho 37.5 cm × alto 59 cm',
    );
    expect(textoMedidas({ anchoCm: 1, altoCm: 2, largoCm: 3 })).toBe(
      'ancho 1 cm × alto 2 cm × largo 3 cm',
    );
    expect(textoMedidas({ anchoCm: null, altoCm: null, largoCm: null })).toBeNull();
  });
});

describe('fichaQueVeElBot', () => {
  it('lista solo los campos con valor, en orden, con medidas y peso formateados', () => {
    const ficha = fichaQueVeElBot({
      nombre: 'Tonelito',
      estado: 'disponible',
      colores: ['azul'],
      ...fichaVacia,
      caracteristicas: ['Fácil de limpiar'],
      capacidadPurificadorLitros: 1.5,
      anchoCm: 37.5,
      altoCm: 59,
      pesoLb: 12,
    });
    expect(ficha).toEqual([
      { etiqueta: 'Nombre', valor: 'Tonelito' },
      { etiqueta: 'Características', valor: ['Fácil de limpiar'] },
      { etiqueta: 'Colores', valor: ['azul'] },
      { etiqueta: 'Capacidad del purificador', valor: '1.5 L' },
      { etiqueta: 'Estado', valor: 'disponible' },
      { etiqueta: 'Medidas', valor: 'ancho 37.5 cm × alto 59 cm' },
      { etiqueta: 'Peso', valor: '12 lbs' },
    ]);
  });
});

describe('faltantesFicha', () => {
  it('a un equipo le exige descripción, material, medidas, peso, purificador y tasa', () => {
    expect(faltantesFicha({ tipo: 'equipo', ...fichaVacia })).toEqual([
      'descripción',
      'material',
      'medidas',
      'peso',
      'purificador',
      'tasa de filtrado',
    ]);
    expect(
      faltantesFicha({
        tipo: 'equipo',
        ...fichaVacia,
        descripcion: 'x',
        material: 'barro',
        anchoCm: 30,
        altoCm: 50,
        capacidadPurificadorLitros: 10,
        tasaFiltrado: '1-2 litros por hora',
      }),
    ).toEqual(['peso']);
  });

  it('no aplica a accesorios ni repuestos', () => {
    expect(faltantesFicha({ tipo: 'accesorio', ...fichaVacia })).toBeNull();
  });
});

describe('contradiccionesFicha', () => {
  const producto = {
    ...fichaVacia,
    colores: ['Azul', 'Blanco'],
    capacidadTexto: '6 L',
    capacidadPurificadorLitros: 1.5,
    anchoCm: 37.5,
    altoCm: 59,
    pesoLb: 12,
  };
  const motivos = (caracteristicas) =>
    contradiccionesFicha({ ...producto, caracteristicas }).map((c) => c.motivo);

  it('detecta un purificador distinto al del campo', () => {
    const [c] = contradiccionesFicha({
      ...producto,
      caracteristicas: ['Fácil de usar', 'Capacidad del purificador de agua 10 L'],
    });
    expect(c).toMatchObject({ indice: 1 });
    expect(c.motivo).toContain('purificador 1.5 L');
  });

  it('no avisa cuando los datos coinciden', () => {
    expect(
      motivos([
        'Purificador de 1.5 litros',
        'Recipiente de 6 litros',
        'Mide 37.5 x 59 cm',
        'Pesa 12 lbs',
        'Disponible en azul y blanca',
        'Filtra 1-2 litros por hora',
      ]),
    ).toEqual([]);
  });

  it('detecta capacidad, medida, peso y color distintos', () => {
    expect(motivos(['Recipiente de 8 L'])).toHaveLength(1);
    expect(motivos(['Alto de 60 cm'])[0]).toContain('60');
    expect(motivos(['Pesa 15 libras'])).toHaveLength(1);
    expect(motivos(['Disponible en color rojo'])[0]).toContain('rojo');
  });

  it('convierte mililitros', () => {
    expect(motivos(['Purificador de 1500 ml'])).toEqual([]);
  });

  it('sin el campo no hay con qué comparar', () => {
    expect(contradiccionesFicha({ ...fichaVacia, caracteristicas: ['Pesa 20 lbs'] })).toEqual([]);
  });
});
