import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FraseForm } from './FraseForm.jsx';
import { FrasesPage } from './FrasesPage.jsx';
import * as hooks from './hooks.js';

vi.mock('./hooks.js');
vi.mock('../auth/hooks.js', () => ({ usePermiso: () => true }));
vi.mock('../configuracion/hooks.js', () => ({
  useInterruptores: () => ({
    data: [{ clave: 'cierre_automatico', habilitado: true, descripcion: null }],
  }),
}));

// <dialog> de jsdom no implementa showModal: lo abrimos con el atributo.
HTMLDialogElement.prototype.showModal ??= function () {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
};

const frase = (id, modulo, situacion, texto, orden = id * 10, activo = true) => ({
  id,
  modulo,
  situacion,
  frase: texto,
  orden,
  activo,
  version: `v${id}`,
  actualizadoEn: '2026-10-28T00:00:00.000Z',
  actualizadoPor: null,
});
const FRASES = [
  frase(1, 'COMPRA', 'general', '¿Algo más? 😊'),
  frase(2, 'COMPRA', 'general', '¿Te ayudo con algo más? 💧'),
  frase(3, 'GLOBAL', 'problema', '¿Pudimos resolverlo? 🛠️'),
];

const mutacion = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null });
let mutaciones;

beforeEach(() => {
  mutaciones = {
    crear: mutacion(),
    editar: mutacion(),
    activo: mutacion(),
    eliminar: mutacion(),
    reordenar: mutacion(),
    cierre: mutacion(),
  };
  hooks.useFrases.mockReturnValue({ data: FRASES, isPending: false, error: null });
  hooks.useCrearFrase.mockReturnValue(mutaciones.crear);
  hooks.useEditarFrase.mockReturnValue(mutaciones.editar);
  hooks.useCambiarActivoFrase.mockReturnValue(mutaciones.activo);
  hooks.useEliminarFrase.mockReturnValue(mutaciones.eliminar);
  hooks.useReordenarFrases.mockReturnValue(mutaciones.reordenar);
  hooks.useCambiarCierreAutomatico.mockReturnValue(mutaciones.cierre);
});
afterEach(cleanup);

const pagina = () =>
  render(
    <MemoryRouter>
      <FrasesPage />
    </MemoryRouter>,
  );

describe('FrasesPage', () => {
  it('avisa del bot sin frases generales y muestra el interruptor', () => {
    pagina();
    expect(screen.getByRole('alert').textContent).toContain('atención al cliente');
    expect(screen.queryByText(/bot de compras no tiene/)).toBeNull();
    expect(screen.getByRole('switch', { name: 'Cierre automático' })).toBeTruthy();
  });

  it('reordena dentro del grupo con los botones', () => {
    pagina();
    fireEvent.click(screen.getByRole('button', { name: 'Bajar: ¿Algo más? 😊' }));
    expect(mutaciones.reordenar.mutate).toHaveBeenCalledWith([
      { id: 2, orden: 10 },
      { id: 1, orden: 20 },
    ]);
  });

  it('no deja mover fuera del grupo (la única de su grupo no se puede subir ni bajar)', () => {
    pagina();
    expect(screen.getByRole('button', { name: 'Subir: ¿Pudimos resolverlo? 🛠️' }).disabled).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Bajar: ¿Pudimos resolverlo? 🛠️' }).disabled).toBe(
      true,
    );
  });

  it('la pestaña Compras muestra sus frases y las GLOBAL, no las de otros módulos', () => {
    hooks.useFrases.mockReturnValue({
      data: [...FRASES, frase(4, 'SAC', 'general', '¿Algo más de tu pedido? 🙏')],
      isPending: false,
      error: null,
    });
    pagina();
    fireEvent.click(screen.getByRole('tab', { name: 'Compras' }));
    expect(screen.queryByText('¿Algo más de tu pedido? 🙏')).toBeNull();
    expect(screen.getByText('¿Pudimos resolverlo? 🛠️')).toBeTruthy();
  });

  it('al eliminar sugiere desactivar en su lugar', () => {
    pagina();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    const dialogo = screen.getByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar en su lugar' }));
    expect(mutaciones.activo.mutate).toHaveBeenCalledWith(
      { id: 1, activo: false, version: 'v1' },
      expect.anything(),
    );
    expect(mutaciones.eliminar.mutate).not.toHaveBeenCalled();
  });
});

describe('FraseForm', () => {
  const formulario = (m = mutacion()) => {
    render(<FraseForm mutacion={m} inicial={{ modulo: 'SAC' }} alCancelar={() => {}} />);
    return m;
  };

  it('cuenta caracteres, inserta emojis y muestra la vista previa', () => {
    formulario();
    const entrada = screen.getByPlaceholderText(/Te ayudo/);
    fireEvent.change(entrada, { target: { value: '¿Algo más?' } });
    entrada.setSelectionRange(10, 10);
    fireEvent.click(screen.getByRole('button', { name: 'Insertar 😊' }));
    expect(entrada.value).toBe('¿Algo más?😊');
    expect(screen.getByText('11/200')).toBeTruthy();
    expect(screen.getAllByText('¿Algo más?😊').length).toBeGreaterThan(0);
  });

  it('no envía una frase con Markdown', async () => {
    const m = formulario();
    fireEvent.change(screen.getByPlaceholderText(/Te ayudo/), {
      target: { value: '¿**Algo** más?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(screen.getByText(/Sin Markdown/)).toBeTruthy());
    expect(m.mutate).not.toHaveBeenCalled();
  });

  it('envía una frase válida con su módulo y situación', async () => {
    const m = formulario();
    fireEvent.change(screen.getByPlaceholderText(/Te ayudo/), {
      target: { value: '  ¿Te ayudo con algo más? 💧 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(m.mutate).toHaveBeenCalled());
    expect(m.mutate.mock.calls[0][0]).toEqual({
      modulo: 'SAC',
      situacion: 'general',
      frase: '¿Te ayudo con algo más? 💧',
      activo: true,
    });
  });
});
