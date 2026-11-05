import { describe, expect, it } from 'vitest';
import { textosTiempo } from './configuracion.js';
import { textoDeEjemplo } from './mensajes.js';
import { esquemaFiltrosSeguimientosIa } from './reportes.js';

describe('seguimiento con IA', () => {
  it('cambia el título del aviso y la ayuda del cierre solo con el interruptor encendido', () => {
    expect(textosTiempo('minutos_aviso_inactividad', false).titulo).toBe('Aviso de inactividad');
    expect(textosTiempo('minutos_aviso_inactividad', true).titulo).toBe(
      'Seguimiento cuando deja de responder',
    );
    expect(textosTiempo('minutos_cierre_inactividad', true).ayuda).toContain('(cierre − aviso)');
  });

  it('ejemplos de {producto} y {promocion}', () => {
    expect(textoDeEjemplo('{producto}: {promocion}', {})).toBe(
      'Ecofiltro Colors: un 10 % de descuento',
    );
    expect(textoDeEjemplo('{promocion}', { promocion: 'un 15 % de descuento' })).toBe(
      'un 15 % de descuento',
    );
  });

  it('valida los filtros de la vista', () => {
    const valida = (f) => esquemaFiltrosSeguimientosIa.safeParse(f).success;
    expect(valida({ desde: '2026-11-01', hasta: '2026-11-04', decision: 'enviado' })).toBe(true);
    expect(valida({ desde: '2026-11-01', hasta: '2026-11-04', decision: '' })).toBe(true);
    expect(valida({ desde: '2026-11-01', hasta: '2026-11-04', decision: 'otra' })).toBe(false);
  });
});
