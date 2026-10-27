import { TABLAS_AUDITADAS } from '@ecofiltro/shared';
import * as repo from './auditoria.repository.js';

// Campos que cambian en cada UPDATE y no aportan al leer el historial (quién y cuándo ya se muestran aparte).
const CAMPOS_IGNORADOS = new Set(['actualizado_en', 'actualizado_por', 'creado_en']);

// Campos con los que una persona reconoce el registro, en orden de preferencia.
// En configuración, la clave va antes que la descripción (que es un texto largo).
const CAMPOS_ETIQUETA = ['nombre', 'titulo', 'pregunta', 'clave', 'descripcion'];

// Qué cambió: en UPDATE solo lo distinto; en INSERT todo lo nuevo; en DELETE todo lo que había.
export function calcularCambios({ operacion, antes, despues }) {
  const campos = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  const cambios = [];
  for (const campo of campos) {
    if (CAMPOS_IGNORADOS.has(campo)) continue;
    const valorAntes = antes?.[campo] ?? null;
    const valorDespues = despues?.[campo] ?? null;
    if (operacion === 'UPDATE' && JSON.stringify(valorAntes) === JSON.stringify(valorDespues))
      continue;
    cambios.push({ campo, antes: valorAntes, despues: valorDespues });
  }
  return cambios;
}

export function calcularEtiqueta({ antes, despues }) {
  const fila = despues ?? antes ?? {};
  const texto = CAMPOS_ETIQUETA.map((c) => fila[c]).find(Boolean) ?? null;
  // En productos y pautas el código (ItemCode en productos) ayuda a distinguir nombres parecidos.
  return fila.codigo && texto ? `${texto} (${fila.codigo})` : (texto ?? fila.codigo ?? null);
}

// La app siempre llena actualizado_por, así que solo cuando el cambio lo hizo el rol de la app
// (`rolApp` = DB_USER, normalmente eco_app) ese campo dice quién fue. Si lo hizo otro rol (psql, n8n…),
// actualizado_por puede ser de una edición anterior: no se lo atribuimos a nadie y se marca como directo.
// ⚠ Si la app comparte su rol con personas que también entran por psql, sus cambios se atribuirían mal:
// por eso la app debe tener su propio rol.
export function atribuir({ usuarioDb, antes, despues }, rolApp) {
  if (usuarioDb !== rolApp) return { origen: 'directo', usuarioApp: null };
  return { origen: 'app', usuarioApp: despues?.actualizado_por ?? antes?.actualizado_por ?? null };
}

export async function buscarHistorial(db, filtros, rolApp) {
  const filas = await repo.buscar(db, filtros, Object.keys(TABLAS_AUDITADAS), rolApp);
  const hayMas = filas.length > filtros.limite;
  const pagina = hayMas ? filas.slice(0, filtros.limite) : filas;

  return {
    entradas: pagina.map((fila) => ({
      id: fila.id,
      tabla: fila.tabla,
      operacion: fila.operacion,
      registroId: fila.registroId,
      etiqueta: calcularEtiqueta(fila),
      ...atribuir(fila, rolApp),
      usuarioDb: fila.usuarioDb,
      creadoEn: fila.creadoEn,
      cambios: calcularCambios(fila),
    })),
    siguiente: hayMas ? pagina.at(-1).id : null,
  };
}
