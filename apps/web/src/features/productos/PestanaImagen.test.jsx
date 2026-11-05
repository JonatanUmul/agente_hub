import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CAMPOS_FICHA } from '@ecofiltro/shared';
import { IndicadorImagen } from './IndicadorImagen.jsx';
import { ProductoForm } from './ProductoForm.jsx';

vi.mock('../pautas/hooks.js', () => ({
  usePautasResumen: () => ({ data: [], isPending: false, error: null }),
}));
vi.mock('../multimedia/hooks.js', () => ({
  useArchivos: () => ({
    data: [
      {
        id: 1,
        tipo: 'imagen',
        hubspotFileId: 'https://f.hubspot.net/azul.jpg',
        descripcion: 'Colors azul',
        color: 'Azul',
        producto: { id: 7 },
      },
      {
        id: 2,
        tipo: 'imagen',
        hubspotFileId: '98765',
        descripcion: 'Colors rojo',
        color: 'Rojo',
        producto: { id: 7 },
      },
      {
        id: 3,
        tipo: 'imagen',
        hubspotFileId: 'https://x/otro.jpg',
        descripcion: 'De otro',
        color: null,
        producto: { id: 8 },
      },
    ],
  }),
}));
afterEach(cleanup);

const producto = (extra = {}) => ({
  id: 7,
  codigo: 'COL',
  nombre: 'Colors',
  tipo: 'equipo',
  familia: 'colors',
  capacidadLitros: null,
  colores: [],
  estado: 'disponible',
  precioBase: null,
  descuentoPct: 0,
  pautas: [],
  palabrasClave: [],
  orden: 10,
  activo: true,
  ...Object.fromEntries(CAMPOS_FICHA.map((c) => [c, c === 'caracteristicas' ? [] : null])),
  pistasVisuales: null,
  fotosReferencia: [],
  version: 'v1',
  ...extra,
});

const formulario = (p = producto()) => {
  const mutacion = { mutate: vi.fn(), isPending: false, error: null };
  render(
    <ProductoForm
      producto={p}
      interruptores={{}}
      mutacion={mutacion}
      alTerminar={() => {}}
      alCancelar={() => {}}
    />,
  );
  return mutacion;
};
const abrirPestana = () =>
  fireEvent.click(screen.getByRole('tab', { name: 'Identificación por imagen' }));

describe('Identificación por imagen en el formulario de producto', () => {
  it('no aparece en accesorios sin datos', () => {
    formulario(producto({ tipo: 'accesorio' }));
    expect(screen.queryByRole('tab', { name: 'Identificación por imagen' })).toBeNull();
  });

  it('toma fotos de Multimedia con URL pública y avisa de las que no la tienen', async () => {
    const mutacion = formulario();
    abrirPestana();
    fireEvent.change(screen.getByRole('textbox', { name: /Pistas visuales/ }), {
      target: { value: 'Base tipo campana' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Usar foto de Multimedia' }));
    expect(screen.getByText('Esta foto no tiene URL pública')).toBeTruthy();
    expect(screen.queryByText('De otro')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    expect(screen.getByLabelText('URL de la foto 1').value).toBe('https://f.hubspot.net/azul.jpg');
    expect(screen.getByText('Ya agregada')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(mutacion.mutate).toHaveBeenCalled());
    expect(mutacion.mutate.mock.calls[0][0]).toMatchObject({
      pistasVisuales: 'Base tipo campana',
      fotosReferencia: [{ url: 'https://f.hubspot.net/azul.jpg', color: 'Azul' }],
    });
  });

  it('no guarda una URL sin https', async () => {
    const mutacion = formulario();
    abrirPestana();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar foto' }));
    fireEvent.change(screen.getByLabelText('URL de la foto 1'), {
      target: { value: 'http://inseguro.com/a.jpg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/empiece con https/)).toBeTruthy();
    expect(mutacion.mutate).not.toHaveBeenCalled();
  });
});

describe('IndicadorImagen', () => {
  it('✓ con pistas y fotos, ⚠ si falta algo, — si está inactivo', () => {
    const { rerender } = render(
      <IndicadorImagen
        producto={producto({
          pistasVisuales: 'x',
          fotosReferencia: [{ url: 'https://a', color: null }],
        })}
      />,
    );
    expect(screen.getByText('✓')).toBeTruthy();
    rerender(<IndicadorImagen producto={producto({ pistasVisuales: 'x' })} />);
    expect(screen.getByLabelText('Falta: fotos de referencia')).toBeTruthy();
    rerender(<IndicadorImagen producto={producto({ activo: false })} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
