import { withTransaction } from '../db/transaction.js';
import { conflictoDeVersion, noEncontrado } from './app-error.js';

// ¿Cambió algún campo? Las fechas se comparan como instantes: el cliente puede mandar la misma
// fecha con otra zona ('...Z' vs '-06:00'). El resto, por su JSON (sirve también para listas).
export function hayCambios(actual, nuevo, campos, camposFecha = []) {
  const comparable = (campo, valor) =>
    camposFecha.includes(campo) && valor ? Date.parse(valor) : JSON.stringify(valor);
  return campos.some((c) => comparable(c, actual[c]) !== comparable(c, nuevo[c]));
}

// Patrón de edición de todos los registros eco_*, dentro de una transacción:
//   1. leer los campos editables bloqueando la fila (FOR UPDATE);
//   2. comparar `version`: si otra persona guardó antes → 409;
//   3. escribir solo si hay cambios (guardar sin cambios no genera auditoría vacía);
//   4. devolver el registro completo.
// `repo` debe tener obtenerEditableBloqueando, actualizar y obtenerPorId.
// `aplicar(actual)` devuelve el estado nuevo (todo el formulario o solo `activo`).
export function editarConVersion(
  db,
  { id, version, correo, repo, campos, camposFecha, aplicar, mensajeNoEncontrado },
) {
  return withTransaction(db, async (client) => {
    const actual = await repo.obtenerEditableBloqueando(client, id);
    if (!actual) throw noEncontrado(mensajeNoEncontrado);
    if (actual.version !== version) throw conflictoDeVersion();

    const nuevo = aplicar(actual);
    if (hayCambios(actual, nuevo, campos, camposFecha)) {
      await repo.actualizar(client, id, nuevo, correo);
    }
    return repo.obtenerPorId(client, id);
  });
}
