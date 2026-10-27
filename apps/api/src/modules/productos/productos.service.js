import { calcularPrecioFinal } from '@ecofiltro/shared';
import { AppError, esViolacionLlaveForanea, noEncontrado } from '../../lib/app-error.js';
import { editarConVersion } from '../../lib/edicion.js';
import * as repo from './productos.repository.js';

const CAMPOS_EDITABLES = [
  'precioBase',
  'descuentoPct',
  'estado',
  'colores',
  'palabrasClave',
  'pautaId',
  'orden',
  'activo',
];

// Precio final con el descuento que aplica hoy (la misma cuenta que hace eco_contexto()).
// Para productos inactivos es null: el bot no los ofrece.
const conPrecioFinal = (producto) => ({
  ...producto,
  precioFinal:
    producto.descuentoVigentePct === null
      ? null
      : calcularPrecioFinal(producto.precioBase, producto.descuentoVigentePct),
});

export async function listarProductos(db) {
  return (await repo.listar(db)).map(conPrecioFinal);
}

export async function obtenerProducto(db, id) {
  const producto = await repo.obtenerPorId(db, id);
  if (!producto) throw noEncontrado('Producto no encontrado');
  return conPrecioFinal(producto);
}

async function editar(db, opciones) {
  try {
    const producto = await editarConVersion(db, {
      ...opciones,
      repo,
      campos: CAMPOS_EDITABLES,
      mensajeNoEncontrado: 'Producto no encontrado',
    });
    return conPrecioFinal(producto);
  } catch (error) {
    if (esViolacionLlaveForanea(error)) {
      throw new AppError({
        codigo: 'PAUTA_INEXISTENTE',
        mensaje: 'La pauta seleccionada no existe',
        estadoHttp: 400,
      });
    }
    throw error;
  }
}

// Reemplaza los campos editables. `version` debe coincidir con la que el usuario vio al abrir el producto.
export const editarProducto = (db, { id, datos, correo }) =>
  editar(db, { id, version: datos.version, correo, aplicar: () => datos });

// Activar / desactivar desde la tabla, sin abrir el formulario completo.
export const cambiarActivo = (db, { id, activo, version, correo }) =>
  editar(db, { id, version, correo, aplicar: (actual) => ({ ...actual, activo }) });
