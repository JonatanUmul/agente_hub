import { describe, expect, it } from 'vitest';
import { errorParametroTexto } from './configuracion.js';
import { camposQueNoAplican } from './ficha.js';
import { camposVision, esUrlPublica, faltantesVision, urlPublicaDeArchivo } from './vision.js';

const fotos = camposVision.fotosReferencia;

describe('fotos de referencia', () => {
  it('solo URLs https', () => {
    expect(esUrlPublica('https://cdn.ejemplo.com/a.jpg')).toBe(true);
    expect(esUrlPublica('http://cdn.ejemplo.com/a.jpg')).toBe(false);
    expect(esUrlPublica('123456789')).toBe(false);
    expect(esUrlPublica('https://')).toBe(false);
  });

  it('máximo 6, sin repetidas, color vacío = null', () => {
    const foto = (n) => ({ url: `https://x.com/${n}.jpg`, color: '' });
    expect(fotos.parse([foto(1)])).toEqual([{ url: 'https://x.com/1.jpg', color: null }]);
    expect(fotos.safeParse([1, 2, 3, 4, 5, 6, 7].map(foto)).success).toBe(false);
    expect(fotos.safeParse([foto(1), foto(1)]).success).toBe(false);
    expect(fotos.safeParse([{ url: 'http://x.com/1.jpg', color: null }]).success).toBe(false);
  });

  it('pistas: hasta 600 caracteres y sin HTML', () => {
    expect(camposVision.pistasVisuales.safeParse('a'.repeat(600)).success).toBe(true);
    expect(camposVision.pistasVisuales.safeParse('a'.repeat(601)).success).toBe(false);
    expect(camposVision.pistasVisuales.safeParse('<b>base</b>').success).toBe(false);
  });
});

describe('faltantesVision', () => {
  const equipo = {
    tipo: 'equipo',
    activo: true,
    pistasVisuales: 'Base ancha',
    fotosReferencia: [{}],
  };
  it('dice qué falta; no aplica a inactivos ni accesorios', () => {
    expect(faltantesVision(equipo)).toEqual([]);
    expect(faltantesVision({ ...equipo, pistasVisuales: ' ', fotosReferencia: [] })).toEqual([
      'pistas',
      'fotos',
    ]);
    expect(faltantesVision({ ...equipo, activo: false })).toBeNull();
    expect(faltantesVision({ ...equipo, tipo: 'accesorio' })).toBeNull();
  });

  it('un accesorio no puede guardar pistas ni fotos; la lista vacía no cuenta', () => {
    expect(camposQueNoAplican('accesorio', { pistasVisuales: 'x', fotosReferencia: [] })).toEqual([
      'pistasVisuales',
    ]);
    expect(camposQueNoAplican('repuesto', { pistasVisuales: 'x', fotosReferencia: [{}] })).toEqual(
      [],
    );
  });
});

describe('Multimedia y configuración', () => {
  it('un archivo de HubSpot solo sirve si su ID ya es una URL pública', () => {
    expect(urlPublicaDeArchivo({ hubspotFileId: '1234' })).toBeNull();
    expect(urlPublicaDeArchivo({ hubspotFileId: 'https://f.hubspot.net/a.jpg' })).toBe(
      'https://f.hubspot.net/a.jpg',
    );
  });

  it('vision_modelo con formato proveedor/modelo', () => {
    expect(errorParametroTexto('vision_modelo', 'google/gemini-2.5-pro')).toBeNull();
    expect(errorParametroTexto('vision_modelo', 'gemini')).toMatch(/proveedor\/modelo/);
    expect(errorParametroTexto('vision_modelo', ' ')).toBe('Requerido');
  });
});
