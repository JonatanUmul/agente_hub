import { MINUTOS_EN_LINEA } from '@ecofiltro/shared';
import * as repo from './accesos.repository.js';

export async function obtenerControl(db, filtros) {
  const datos = { ...filtros, minutosEnLinea: MINUTOS_EN_LINEA };
  const [resumen, sesiones, eventos] = await Promise.all([
    repo.resumir(db, datos),
    repo.listarSesiones(db, datos),
    repo.listarEventos(db, datos),
  ]);
  return { resumen, sesiones, eventos };
}
