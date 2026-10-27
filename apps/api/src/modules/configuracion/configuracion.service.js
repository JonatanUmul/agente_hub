import { INTERRUPTORES } from '@ecofiltro/shared';
import { withTransaction } from '../../db/transaction.js';
import { noEncontrado } from '../../lib/app-error.js';
import * as repo from './configuracion.repository.js';

export const listarInterruptores = (db) => repo.listarPorClaves(db, INTERRUPTORES);

// La ruta ya valida que `clave` sea un interruptor. Si la fila no existe en la base no la creamos:
// las claves las define quien administra el bot.
export function cambiarInterruptor(db, { clave, habilitado, correo }) {
  return withTransaction(db, async (client) => {
    const actualizado = await repo.actualizarBooleano(client, {
      clave,
      valor: habilitado,
      actualizadoPor: correo,
    });
    if (!actualizado) throw noEncontrado(`La clave ${clave} no existe en eco_configuracion`);
    return actualizado;
  });
}
