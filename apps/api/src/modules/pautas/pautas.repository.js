import { aNumero } from '../../lib/numeros.js';

// "Vigente" usa la misma condición que eco_v_catalogo y eco_contexto().
export async function listarResumen(db) {
  const { rows } = await db.query(
    `SELECT id, codigo, nombre, descuento_pct, activo,
            (activo AND (vigente_desde IS NULL OR vigente_desde <= now())
                    AND (vigente_hasta IS NULL OR vigente_hasta > now())) AS vigente
     FROM eco_pautas
     ORDER BY activo DESC, nombre, id`,
  );
  return rows.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    descuentoPct: aNumero(fila.descuento_pct),
    activo: fila.activo,
    vigente: fila.vigente,
  }));
}
