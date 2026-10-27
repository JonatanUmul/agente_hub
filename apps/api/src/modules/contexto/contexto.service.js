import * as repo from './contexto.repository.js';

// Sin transformar: la vista previa debe mostrar exactamente lo que recibe el bot.
export const obtenerContexto = (db, modulo) => repo.obtener(db, modulo);
