import { CLAVES_PARAMETROS, INTERRUPTORES, errorParametro } from '@ecofiltro/shared';
import { withTransaction } from '../../db/transaction.js';
import { AppError, conflictoDeVersion, noEncontrado } from '../../lib/app-error.js';
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

export const listarParametros = (db) => repo.listarParametros(db, CLAVES_PARAMETROS);

// El rango depende de la clave (PARAMETROS_ENTEROS). Guardar el mismo valor no escribe (no ensucia la auditoría).
export async function cambiarParametro(db, { clave, valor, version, correo }) {
  const error = errorParametro(clave, valor);
  if (error) {
    throw new AppError({ codigo: 'VALOR_FUERA_DE_RANGO', mensaje: error, estadoHttp: 400 });
  }
  return withTransaction(db, async (client) => {
    const [actual] = await repo.listarParametros(client, [clave], { bloquear: true });
    if (!actual) throw noEncontrado(`La clave ${clave} no existe en eco_configuracion`);
    if (actual.version !== version) throw conflictoDeVersion();
    if (actual.valor !== valor) {
      await repo.actualizarParametro(client, { clave, valor, actualizadoPor: correo });
    }
    const [nuevo] = await repo.listarParametros(client, [clave]);
    return nuevo;
  });
}
