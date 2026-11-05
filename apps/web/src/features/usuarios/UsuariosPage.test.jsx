import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { detalleEvento } from './ControlAccesos.jsx';
import { UsuariosPage } from './UsuariosPage.jsx';
import * as hooks from './hooks.js';

vi.mock('./hooks.js');
vi.mock('../auth/hooks.js', () => ({
  usePermiso: () => true,
  useSesion: () => ({ data: { usuario: { id: 1 } } }),
}));

HTMLDialogElement.prototype.showModal ??= function () {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
};

const usuario = (id, nombre) => ({
  id,
  correo: `${nombre.toLowerCase()}@eco.com`,
  nombre,
  rol: 'comercial',
  activo: true,
  bloqueadoHasta: null,
  ultimoAcceso: null,
  creadoEn: '2026-10-01T00:00:00.000Z',
});
const ACCESOS = {
  resumen: [
    {
      usuarioId: 2,
      nombre: 'Ana',
      correo: 'ana@eco.com',
      sesiones: 2,
      minutos: 95,
      primeraEntrada: '2026-11-04T14:00:00.000Z',
      ultimaSalida: '2026-11-04T16:00:00.000Z',
      fallidos: 1,
      enLinea: true,
    },
  ],
  sesiones: [
    {
      id: 1,
      usuarioId: 2,
      nombre: 'Ana',
      correo: 'ana@eco.com',
      inicio: '2026-11-04T14:00:00.000Z',
      fin: '2026-11-04T15:35:00.000Z',
      minutos: 95,
      motivo: 'salida',
      enLinea: false,
      ip: '10.0.0.1',
      navegador: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/130.0',
    },
  ],
  eventos: [
    {
      id: 1,
      usuarioId: 2,
      nombre: 'Ana',
      correo: 'ana@eco.com',
      evento: 'acceso_fallido',
      detalle: { motivo: 'contrasena' },
      hechoPor: null,
      ip: '10.0.0.1',
      creadoEn: '2026-11-04T13:59:00.000Z',
    },
  ],
};

const mutacion = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null });
let cerrar;
beforeEach(() => {
  cerrar = mutacion();
  hooks.useUsuarios.mockReturnValue({
    data: [usuario(1, 'Yo'), usuario(2, 'Ana')],
    isPending: false,
    error: null,
  });
  hooks.useAccesos.mockReturnValue({ data: ACCESOS, isPending: false, error: null });
  hooks.useCrearUsuario.mockReturnValue(mutacion());
  hooks.useEditarUsuario.mockReturnValue(mutacion());
  hooks.useRestablecerContrasena.mockReturnValue(mutacion());
  hooks.useCerrarSesiones.mockReturnValue(cerrar);
});
afterEach(cleanup);

describe('UsuariosPage', () => {
  it('cierra las sesiones de otro usuario tras confirmar (no las propias)', () => {
    render(<UsuariosPage />);
    expect(screen.getAllByRole('button', { name: 'Cerrar sesiones' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesiones' }));
    const dialogo = screen.getAllByRole('dialog').find((d) => d.open);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar sesiones' }));
    expect(cerrar.mutate).toHaveBeenCalledWith({ id: 2 }, expect.anything());
  });

  it('el control de accesos muestra entradas, salidas y movimientos', () => {
    render(<UsuariosPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Control de accesos' }));
    expect(screen.getByText('1 en línea ahora')).toBeTruthy();
    expect(screen.getAllByText('1 h 35 min')).toHaveLength(2);
    expect(screen.getByText('Cerró sesión')).toBeTruthy();
    expect(screen.getByText('Firefox en macOS')).toBeTruthy();
    expect(screen.getByText('Acceso fallido')).toBeTruthy();
    expect(screen.getByText('contraseña incorrecta')).toBeTruthy();
    expect(hooks.useAccesos).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: '' }), true);
  });
});

describe('detalleEvento', () => {
  it('describe los cambios de un usuario', () => {
    expect(
      detalleEvento({
        evento: 'editado',
        detalle: { rol: { antes: 'admin', despues: 'lectura' } },
      }),
    ).toBe('rol: admin → lectura');
    expect(detalleEvento({ evento: 'bloqueo', detalle: { minutos: 15 } })).toBe('por 15 min');
  });
});
