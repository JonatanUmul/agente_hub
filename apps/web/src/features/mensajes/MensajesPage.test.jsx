import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MensajesPage } from './MensajesPage.jsx';
import * as hooks from './hooks.js';

vi.mock('./hooks.js');
vi.mock('../auth/hooks.js', () => ({ usePermiso: () => true }));
vi.mock('../configuracion/hooks.js', () => ({
  useParametros: () => ({
    data: [
      { clave: 'minutos_aviso_inactividad', valor: 10 },
      { clave: 'minutos_cierre_inactividad', valor: 25 },
    ],
  }),
}));
vi.mock('../pautas/hooks.js', () => ({ usePautas: () => ({ data: [] }) }));

HTMLDialogElement.prototype.showModal ??= function () {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
};
Element.prototype.scrollIntoView ??= () => {};

const v = (id, clave, texto, activo = true) => ({
  id,
  clave,
  texto,
  activo,
  orden: id * 10,
  version: `v${id}`,
  actualizadoEn: '2026-10-29T00:00:00.000Z',
  actualizadoPor: null,
});
const TIPOS = [
  {
    clave: 'menu_bienvenida',
    categoria: 'Inicio',
    titulo: 'Menú inicial',
    descripcion: 'Primer mensaje',
    comodines: [],
    varias: false,
    orden: 10,
    versiones: [v(1, 'menu_bienvenida', '¿En qué te ayudo?')],
  },
  {
    clave: 'inactividad_aviso',
    categoria: 'Inactividad',
    titulo: 'Aviso de inactividad',
    descripcion: null,
    comodines: ['minutos'],
    varias: true,
    orden: 10,
    versiones: [],
  },
];

const mutacion = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null });
let m;
beforeEach(() => {
  m = {
    crear: mutacion(),
    editar: mutacion(),
    activo: mutacion(),
    eliminar: mutacion(),
    orden: mutacion(),
  };
  hooks.useMensajes.mockReturnValue({ data: TIPOS, isPending: false, error: null });
  hooks.useCrearMensaje.mockReturnValue(m.crear);
  hooks.useEditarMensaje.mockReturnValue(m.editar);
  hooks.useCambiarActivoMensaje.mockReturnValue(m.activo);
  hooks.useEliminarMensaje.mockReturnValue(m.eliminar);
  hooks.useReordenarMensajes.mockReturnValue(m.orden);
});
afterEach(cleanup);

const pagina = () =>
  render(
    <MemoryRouter>
      <MensajesPage />
    </MemoryRouter>,
  );

describe('MensajesPage', () => {
  it('agrupa por categoría y avisa del mensaje sin versiones activas', () => {
    pagina();
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeTruthy();
    const tarjeta = screen.getByText('Aviso de inactividad').closest('article');
    expect(within(tarjeta).getByText(/texto por defecto/)).toBeTruthy();
  });

  it('desactivar la última versión de un mensaje protegido pide confirmar', () => {
    pagina();
    fireEvent.click(screen.getByRole('switch', { name: 'Activa: ¿En qué te ayudo?' }));
    expect(m.activo.mutate).not.toHaveBeenCalled();
    const dialogo = screen.getByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
    expect(m.activo.mutate).toHaveBeenCalledWith(
      { id: 1, activo: false, version: 'v1', confirmar: true },
      expect.anything(),
    );
  });

  it('inserta el comodín, muestra el ejemplo y rechaza comodines ajenos', () => {
    pagina();
    const tarjeta = screen.getByText('Aviso de inactividad').closest('article');
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Agregar versión' }));
    const texto = within(tarjeta).getByLabelText('Texto');
    fireEvent.change(texto, { target: { value: 'Cerramos en  min' } });
    texto.setSelectionRange(12, 12);
    fireEvent.click(within(tarjeta).getByRole('button', { name: '{minutos}' }));
    expect(texto.value).toBe('Cerramos en {minutos} min');
    expect(within(tarjeta).getByText('Cerramos en 15 min')).toBeTruthy();

    fireEvent.change(texto, { target: { value: 'Hola {nombre}' } });
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Agregar' }));
    expect(within(tarjeta).getByText(/Comodín no permitido/)).toBeTruthy();
    expect(m.crear.mutate).not.toHaveBeenCalled();
  });

  it('filtra por texto', () => {
    pagina();
    fireEvent.change(screen.getByPlaceholderText('Buscar texto'), { target: { value: 'ayudo' } });
    expect(screen.queryByText('Aviso de inactividad')).toBeNull();
    expect(screen.getByText('Menú inicial')).toBeTruthy();
  });
});
