import { cargarEnv } from '../../src/config/env.js';
import { migrar } from '../../src/db/migrar.js';

// Se ejecuta una vez antes de las pruebas de integración: deja el esquema gestion al día.
export default async function preparar() {
  await migrar(cargarEnv());
}
