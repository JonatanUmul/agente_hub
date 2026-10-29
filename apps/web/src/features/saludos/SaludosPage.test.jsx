import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SaludoForm } from './SaludoForm.jsx';
import { SaludosPage } from './SaludosPage.jsx';
import * as hooks from './hooks.js';

vi.mock('./hooks.js');
vi.mock('../auth/hooks.js', () => ({ usePermiso: () => true }));

HTMLDialogElement.prototype.showModal ??= function () {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
};

const saludo = (id, nombre, extra = {}) => ({
  id,
  nombre,
  modulo: 'GLOBAL',
  saludo: `¡{momento}! ${nombre}`,
  fechaInicio: null,
  fechaFin: null,
  repetirAnual: false,
  prioridad: 0,
  activo: true,
  vigenteHoy: true,
  version: `v${id}`,
  actualizadoEn: '2026-10-28T00:00:00.000Z',
  actualizadoPor: null,
  ...extra,
});
const NAVIDAD = saludo(2, 'Navidad', {
  fechaInicio: '2026-12-15',
  fechaFin: '2026-12-26',
  repetirAnual: true,
  prioridad: 10,
  vigenteHoy: false,
});

const mutacion = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null });

beforeEach(() => {
  hooks.useSaludos.mockReturnValue({
    data: [saludo(1, 'Normal'), NAVIDAD],
    isPending: false,
    error: null,
  });
  hooks.useSaludoVigente.mockImplementation((modulo) => ({
    data: { modulo, saludo: '¡Buenos días! Normal' },
  }));
  for (const h of [
    'useCrearSaludo',
    'useEditarSaludo',
    'useCambiarActivoSaludo',
    'useEliminarSaludo',
  ])
    hooks[h].mockReturnValue(mutacion());
});
afterEach(cleanup);

const pagina = () =>
  render(
    <MemoryRouter>
      <SaludosPage />
    </MemoryRouter>,
  );

describe('SaludosPage', () => {
  it('muestra la vigencia y la etiqueta Vigente hoy, con enlace al texto del menú y sin simulador', () => {
    pagina();
    expect(screen.queryByText('Hoy el bot saluda así')).toBeNull();
    expect(screen.getByRole('link', { name: 'Texto del menú inicial' }).getAttribute('href')).toBe(
      '/mensajes#menu_bienvenida',
    );
    expect(screen.queryByText('Simulador')).toBeNull();
    expect(screen.getByText('Cada año del 15 dic al 26 dic')).toBeTruthy();
    expect(screen.getAllByText('Vigente hoy')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('alerta si no hay saludo base', () => {
    hooks.useSaludos.mockReturnValue({ data: [NAVIDAD], isPending: false, error: null });
    pagina();
    expect(screen.getByRole('alert').textContent).toContain('Sin saludo base');
  });

  it('ordena por fecha', () => {
    pagina();
    fireEvent.change(screen.getByDisplayValue('Prioridad'), { target: { value: 'fecha' } });
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas[0].textContent).toContain('Normal');
  });
});

describe('SaludoForm', () => {
  const formulario = (extra = {}) => {
    const m = mutacion();
    render(
      <SaludoForm
        mutacion={m}
        saludos={[saludo(1, 'Normal'), NAVIDAD]}
        alCancelar={() => {}}
        {...extra}
      />,
    );
    return m;
  };
  const escribir = (placeholder, value) =>
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

  it('inserta {momento}, cuenta caracteres y no envía comodines desconocidos', async () => {
    const m = formulario();
    escribir('Navidad', 'Prueba');
    const texto = screen.getByPlaceholderText(/Soy Eco/);
    fireEvent.change(texto, { target: { value: '¡!' } });
    texto.setSelectionRange(1, 1);
    fireEvent.click(screen.getByRole('button', { name: '{momento}' }));
    expect(texto.value).toBe('¡{momento}!');
    expect(screen.getByText('11/300')).toBeTruthy();

    fireEvent.change(texto, { target: { value: 'Hola {cliente}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(screen.getByText(/único comodín/)).toBeTruthy());
    expect(m.mutate).not.toHaveBeenCalled();
  });

  it('en temporada envía fechas y avisa del choque con otro de igual prioridad', async () => {
    const m = formulario();
    escribir('Navidad', 'Otra Navidad');
    escribir(/Soy Eco/, '¡Felices fiestas!');
    fireEvent.click(screen.getByRole('button', { name: 'Temporada' }));
    fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-12-20' } });
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2026-12-22' } });
    fireEvent.change(screen.getByLabelText(/^Prioridad/), { target: { value: '10' } });
    expect(screen.getByText(/«Navidad»/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(m.mutate).toHaveBeenCalled());
    expect(m.mutate.mock.calls[0][0]).toMatchObject({
      nombre: 'Otra Navidad',
      fechaInicio: '2026-12-20',
      fechaFin: '2026-12-22',
      repetirAnual: true,
      prioridad: 10,
    });
  });

  it('«Siempre» guarda sin fechas', async () => {
    const m = formulario();
    escribir('Navidad', 'Normal 2');
    escribir(/Soy Eco/, '¡{momento}!');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(m.mutate).toHaveBeenCalled());
    expect(m.mutate.mock.calls[0][0]).toMatchObject({ fechaInicio: null, fechaFin: null });
  });
});
