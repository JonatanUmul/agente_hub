import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CAMPOS_FICHA } from '@ecofiltro/shared';
import * as api from './api.js';
import { FichaCompleta, tieneAvisos } from './FichaCompleta.jsx';
import { ProductoForm } from './ProductoForm.jsx';
import { valoresParaDuplicar } from './valoresFormulario.js';

vi.mock('./api.js');
vi.mock('../pautas/hooks.js', () => ({
  usePautasResumen: () => ({ data: [], isPending: false, error: null }),
}));
vi.mock('../multimedia/hooks.js', () => ({ useArchivos: () => ({ data: [] }) }));
afterEach(cleanup);

const producto = (extra = {}) => ({
  id: 7,
  codigo: 'CERAMICA',
  nombre: 'Ecofiltro Cerámica',
  tipo: 'equipo',
  familia: 'CERAMICA',
  variante: null,
  nombreCorto: null,
  capacidadLitros: 20,
  colores: ['azul'],
  coloresConFoto: [],
  estado: 'disponible',
  precioBase: 400,
  descuentoPct: 0,
  pautas: [{ id: 3, nombre: 'Navidad' }],
  palabrasClave: ['barro'],
  orden: 10,
  activo: true,
  ...Object.fromEntries(CAMPOS_FICHA.map((c) => [c, c === 'caracteristicas' ? [] : null])),
  material: 'Cerámica',
  pistasVisuales: 'Base ancha',
  fotosReferencia: [{ url: 'https://x.com/a.jpg', color: 'Azul' }],
  version: 'v1',
  ...extra,
});

let mutacion;
beforeEach(() => {
  mutacion = { mutate: vi.fn(), isPending: false, error: null };
});
const formulario = (props) =>
  render(
    <ProductoForm
      interruptores={{}}
      mutacion={mutacion}
      alTerminar={() => {}}
      alCancelar={() => {}}
      {...props}
    />,
  );
// Las etiquetas incluyen la ayuda del campo: se buscan por cómo empiezan.
const campo = (etiqueta) => screen.getByLabelText(new RegExp(`^${etiqueta}(?! corto)`));
const escribir = (etiqueta, valor) =>
  fireEvent.change(campo(etiqueta), { target: { value: valor } });

describe('crear y duplicar', () => {
  it('duplicar copia la ficha pero no el código, las pautas, los colores ni las fotos', () => {
    const v = valoresParaDuplicar(producto());
    expect(v).toMatchObject({
      codigo: '',
      nombre: 'Ecofiltro Cerámica (copia)',
      activo: false,
      pautaIds: [],
      colores: '',
      fotosReferencia: [],
      material: 'Cerámica',
      palabrasClave: 'barro',
      capacidadLitros: 20,
      pistasVisuales: 'Base ancha',
    });
  });

  it('crea una variante con el ItemCode en mayúsculas mientras se escribe', async () => {
    formulario({ valoresIniciales: valoresParaDuplicar(producto()) });
    escribir('ItemCode', 'ceramica flor-azul');
    expect(campo('ItemCode').value).toBe('CERAMICAFLOR-AZUL');
    escribir('Variante', 'Flor Azul');
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    await waitFor(() => expect(mutacion.mutate).toHaveBeenCalled());
    expect(mutacion.mutate.mock.calls[0][0]).toMatchObject({
      codigo: 'CERAMICAFLOR-AZUL',
      variante: 'Flor Azul',
      familia: 'CERAMICA',
      precioBase: 400,
    });
  });

  it('un producto nuevo sin precio no se guarda, salvo descontinuado', async () => {
    formulario({});
    escribir('ItemCode', 'NUEVO');
    escribir('Nombre', 'Nuevo');
    escribir('Familia', 'X');
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    expect(
      await screen.findByText('Requerido, salvo que el estado sea «descontinuado»'),
    ).toBeTruthy();
    expect(mutacion.mutate).not.toHaveBeenCalled();
  });
});

describe('cambiar el ItemCode', () => {
  it('muestra el impacto y pide marcar los textos antes de guardar', async () => {
    api.obtenerImpactoCodigo.mockResolvedValue({
      conflicto: null,
      dependencias: { multimedia: 5, productosPautas: 1, multimediaPautas: 2 },
      menciones: [{ tabla: 'eco_reglas_bot', id: 1, etiqueta: 'R1 · Precios', activo: true }],
    });
    formulario({ producto: producto() });
    escribir('ItemCode', 'ceramica-agua');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/5 archivo\(s\) de multimedia, 1 pauta/)).toBeTruthy();
    expect(screen.getByText('Regla: R1 · Precios')).toBeTruthy();
    const confirmar = screen.getByRole('button', { name: 'Confirmar y guardar' });
    expect(confirmar.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Los corregiré a mano'));
    fireEvent.click(confirmar);
    expect(mutacion.mutate.mock.calls[0][0]).toMatchObject({
      id: 7,
      codigo: 'CERAMICA-AGUA',
      confirmarCambioCodigo: true,
    });
  });

  it('si choca con otro producto lo dice y no avanza', async () => {
    api.obtenerImpactoCodigo.mockResolvedValue({
      conflicto: { id: 9, codigo: 'LLAVE', nombre: 'Llave plástica', activo: false },
      dependencias: { multimedia: 0, productosPautas: 0, multimediaPautas: 0 },
      menciones: [],
    });
    formulario({ producto: producto() });
    escribir('ItemCode', 'llave');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('Ya lo usa «Llave plástica» (ItemCode LLAVE, inactivo)'),
    ).toBeTruthy();
    expect(mutacion.mutate).not.toHaveBeenCalled();
  });
});

describe('avisos', () => {
  it('marca sin precio, color sin foto y descontinuado activo', () => {
    const p = producto({
      precioBase: null,
      colores: ['azul', 'naranja'],
      coloresConFoto: ['Azul'],
    });
    render(<FichaCompleta producto={p} />);
    expect(screen.getByText('⚠ Activo y disponible, pero sin precio')).toBeTruthy();
    expect(screen.getByText('⚠ Sin foto activa del color: naranja')).toBeTruthy();
    expect(tieneAvisos(producto({ estado: 'descontinuado', coloresConFoto: ['azul'] }))).toBe(true);
  });
});
