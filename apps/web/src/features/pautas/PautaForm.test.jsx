import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PautaForm } from './PautaForm.jsx';

const producto = (id, nombre, extra = {}) => ({
  id,
  nombre,
  codigo: `C${id}`,
  tipo: 'equipo',
  estado: 'disponible',
  precioBase: 500,
  activo: true,
  pautas: [],
  ...extra,
});
const PRODUCTOS = [
  producto(1, 'Colors', {
    pautas: [{ id: 9, nombre: 'Navidad', vigente: true, descuentoPct: 15 }],
  }),
  producto(2, 'Clásico', { estado: 'agotado' }),
  producto(3, 'Filtro', { tipo: 'repuesto' }),
  producto(4, 'Viejo', { activo: false }),
];
const archivo = (id, descripcion, extra = {}) => ({
  id,
  tipo: 'imagen',
  hubspotFileId: `H${id}`,
  descripcion,
  producto: { id: 1, codigo: 'C1', nombre: 'Colors' },
  color: 'Azul',
  pautas: [],
  pautaIdPrincipal: null,
  orden: id,
  activo: true,
  ...extra,
});
const ARCHIVOS = [
  archivo(10, 'Foto azul'),
  archivo(11, 'Arte Visa', { producto: null, color: null }),
];

vi.mock('../productos/hooks.js', () => ({ useProductos: () => ({ data: PRODUCTOS }) }));
vi.mock('../multimedia/hooks.js', () => ({ useArchivos: () => ({ data: ARCHIVOS }) }));
vi.mock('../configuracion/hooks.js', () => ({
  useParametros: () => ({ data: [{ clave: 'max_fotos_pauta', valor: 1 }] }),
}));
afterEach(cleanup);

const PAUTA = {
  id: 5,
  codigo: 'VISA',
  nombre: 'Visa Cuotas',
  mensajeCliente: 'Paga en cuotas',
  descuentoPct: null,
  palabrasClave: [],
  vigenteDesde: null,
  vigenteHasta: null,
  activo: true,
  aplicaTodos: false,
  productoIds: [4],
  multimediaIds: [],
  version: 'v1',
};

const formulario = (props = {}) => {
  const mutacion = { mutate: vi.fn(), isPending: false, error: null };
  const vista = render(
    <PautaForm
      pauta={PAUTA}
      mutacion={mutacion}
      alTerminar={() => {}}
      alCancelar={() => {}}
      {...props}
    />,
  );
  return { mutacion, ...vista };
};
const guardarYConfirmar = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y guardar' }));
};

describe('PautaForm: modelos', () => {
  it('agrupa por tipo, avisa de otra pauta con descuento y conserva los inactivos', async () => {
    const { mutacion } = formulario();
    expect(screen.getByText('Equipos')).toBeTruthy();
    expect(screen.getByText('Repuestos')).toBeTruthy();
    expect(screen.queryByText('Viejo')).toBeNull();
    expect(screen.getByText('agotado')).toBeTruthy();
    expect(screen.getByText(/1 producto\(s\) inactivo/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Todos los equipos' }));
    expect(screen.getByText(/También está en «Navidad» \(15%\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Modelos')).toBeTruthy(); // se confirma: 1 → 3
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y guardar' }));
    await waitFor(() => expect(mutacion.mutate).toHaveBeenCalled());
    expect(mutacion.mutate.mock.calls[0][0]).toMatchObject({ id: 5, productoIds: [1, 2, 4] });
  });

  it('«Aplica a todos los modelos» oculta la lista y no borra los modelos', async () => {
    const { mutacion } = formulario();
    fireEvent.click(screen.getByRole('switch', { name: 'Aplica a todos los modelos' }));
    expect(screen.queryByText('Equipos')).toBeNull();
    await guardarYConfirmar();
    await waitFor(() => expect(mutacion.mutate).toHaveBeenCalled());
    expect(mutacion.mutate.mock.calls[0][0]).toMatchObject({ aplicaTodos: true, productoIds: [4] });
  });
});

describe('PautaForm: multimedia', () => {
  it('con un arte, lo que verá el cliente son solo los artes', () => {
    formulario();
    const vista = () => screen.getByText('Lo que verá el cliente').parentElement;
    expect(within(vista()).getByText(/Sin arte: el bot envía hasta 1 foto/)).toBeTruthy();
    const casilla = (texto) =>
      screen.getAllByText(texto)[0].closest('label').querySelector('input');
    fireEvent.click(casilla('Foto azul'));
    expect(within(vista()).getByText('Foto azul')).toBeTruthy();
    fireEvent.click(casilla('Arte Visa'));
    expect(within(vista()).getByText(/Con arte/)).toBeTruthy();
    expect(within(vista()).getByText('Arte Visa')).toBeTruthy();
    expect(within(vista()).queryByText('Foto azul')).toBeNull();
  });

  it('filtra por texto', () => {
    formulario();
    fireEvent.change(screen.getByLabelText('Buscar archivo'), { target: { value: 'visa' } });
    expect(screen.queryByText('Foto azul')).toBeNull();
  });

  it('suma a la selección un arte recién agregado desde «Imagen de la pauta»', async () => {
    const { mutacion, rerender } = formulario({ multimediaIdsServidor: [] });
    rerender(
      <PautaForm
        pauta={PAUTA}
        multimediaIdsServidor={[11]}
        mutacion={mutacion}
        alTerminar={() => {}}
        alCancelar={() => {}}
      />,
    );
    await guardarYConfirmar();
    await waitFor(() => expect(mutacion.mutate).toHaveBeenCalled());
    expect(mutacion.mutate.mock.calls[0][0].multimediaIds).toEqual([11]);
  });
});
