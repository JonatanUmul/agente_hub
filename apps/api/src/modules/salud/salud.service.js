import { pingBaseDatos } from './salud.repository.js';

// La API sigue respondiendo aunque la base caiga: el healthcheck debe reportarlo, no fallar.
export async function obtenerSalud(db) {
  let baseDatos = 'ok';
  try {
    await pingBaseDatos(db);
  } catch {
    baseDatos = 'sin_conexion';
  }
  return {
    estado: baseDatos === 'ok' ? 'ok' : 'degradado',
    baseDatos,
    hora: new Date().toISOString(),
  };
}
