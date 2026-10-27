import { calcularPrecioFinal } from '@ecofiltro/shared';
import { withTransaction } from '../../db/transaction.js';
import {
  AppError,
  conflictoDeVersion,
  esViolacionLlaveForanea,
  noEncontrado,
} from '../../lib/app-error.js';
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

const hayCambios = (actual, nuevo) =>
  CAMPOS_EDITABLES.some((campo) => JSON.stringify(actual[campo]) !== JSON.stringify(nuevo[campo]));

// Reemplaza los campos editables. `version` debe coincidir con la que el usuario vio al abrir el producto.
export async function editarProducto(db, { id, datos, correo }) {
  try {
    return await withTransaction(db, async (client) => {
      const actual = await repo.obtenerEditableBloqueando(client, id);
      if (!actual) throw noEncontrado('Producto no encontrado');
      if (actual.version !== datos.version) throw conflictoDeVersion();

      // Guardar sin cambios no escribe: evita registros vacíos en la auditoría.
      if (hayCambios(actual, datos)) await repo.actualizar(client, id, datos, correo);
      return conPrecioFinal(await repo.obtenerPorId(client, id));
    });
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

// Activar / desactivar desde la tabla, sin abrir el formulario completo.
export function cambiarActivo(db, { id, activo, version, correo }) {
  return withTransaction(db, async (client) => {
    const actual = await repo.obtenerEditableBloqueando(client, id);
    if (!actual) throw noEncontrado('Producto no encontrado');
    if (actual.version !== version) throw conflictoDeVersion();

    if (actual.activo !== activo) await repo.actualizar(client, id, { ...actual, activo }, correo);
    return conPrecioFinal(await repo.obtenerPorId(client, id));
  });
}
