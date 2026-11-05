import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TiemposPage } from './TiemposPage.jsx';
import * as hooks from './hooks.js';

vi.mock('./hooks.js');
vi.mock('../auth/hooks.js', () => ({ usePermiso: () => true }));

const parametro = (clave, valor) => ({
  clave,
  valor,
  version: 'v',
  actualizadoEn: '',
  actualizadoPor: null,
});
const interruptores = (ia) => [
  { clave: 'seguimiento_ia_activo', habilitado: ia },
  { clave: 'recuperacion_compra_activa', habilitado: true },
];
const mutacion = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null });

beforeEach(() => {
  hooks.useParametros.mockReturnValue({
    data: [parametro('minutos_aviso_inactividad', 10), parametro('minutos_cierre_inactividad', 25)],
    isPending: false,
    error: null,
  });
  hooks.useCambiarInterruptor.mockReturnValue(mutacion());
  hooks.useCambiarParametro.mockReturnValue(mutacion());
});
afterEach(cleanup);

const pagina = (ia) => {
  hooks.useInterruptores.mockReturnValue({ data: interruptores(ia) });
  render(
    <MemoryRouter>
      <TiemposPage />
    </MemoryRouter>,
  );
};

describe('TiemposPage', () => {
  it('apagado: resumen de aviso y cierre con sus mensajes', () => {
    pagina(false);
    expect(screen.getByText('Aviso de inactividad')).toBeTruthy();
    expect(screen.getByText('Conversación normal')).toBeTruthy();
    expect(screen.queryByText(/No se usa mientras/)).toBeNull();
  });

  it('encendido: textos del seguimiento con IA y nota en el seguimiento de compra', () => {
    pagina(true);
    expect(screen.getByText('Seguimiento cuando deja de responder')).toBeTruthy();
    expect(screen.getByText(/\+15 min sin respuesta/)).toBeTruthy();
    expect(screen.getByText(/la IA envía un seguimiento/)).toBeTruthy();
    expect(
      screen.getByText('No se usa mientras el seguimiento con IA está encendido'),
    ).toBeTruthy();
    expect(screen.queryByText('Conversación normal')).toBeNull();
  });
});
