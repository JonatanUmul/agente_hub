// Lectura de eco_auditoria (la llena el trigger eco_auditar(); la app nunca escribe aquí a mano).
//
// Cada filtro es opcional: `$n IS NULL OR ...` lo desactiva cuando no se envía. Así una sola consulta
// fija, parametrizada y legible cubre todas las combinaciones.
// Paginación por cursor (id < antesDe): estable aunque entren registros nuevos mientras se navega.
// `rolApp` es el usuario de PostgreSQL con el que se conecta la app (DB_USER, normalmente eco_app).
export async function buscar(db, filtros, tablas, rolApp) {
  const { rows } = await db.query(
    `SELECT id, tabla, operacion, registro_id, antes, despues, usuario_db, creado_en
     FROM eco_auditoria
     WHERE tabla = ANY($1::text[])
       AND ($2::text IS NULL OR tabla = $2)
       AND ($3::text IS NULL OR operacion = $3)
       AND ($4::text IS NULL OR registro_id = $4)
       AND ($5::text IS NULL
            OR ($5 = 'app' AND usuario_db = $11)
            OR ($5 = 'directo' AND usuario_db <> $11))
       AND ($6::text IS NULL
            OR (usuario_db = $11
                AND lower(COALESCE(despues->>'actualizado_por', antes->>'actualizado_por')) = $6))
       AND ($7::timestamptz IS NULL OR creado_en >= $7)
       AND ($8::timestamptz IS NULL OR creado_en < $8)
       AND ($9::bigint IS NULL OR id < $9)
     ORDER BY id DESC
     LIMIT $10`,
    [
      tablas,
      filtros.tabla ?? null,
      filtros.operacion ?? null,
      filtros.registroId ?? null,
      filtros.origen ?? null,
      filtros.usuario ?? null,
      filtros.desde ?? null,
      filtros.hasta ?? null,
      filtros.antesDe ?? null,
      // Uno de más para saber si hay otra página sin hacer un COUNT.
      filtros.limite + 1,
      rolApp,
    ],
  );
  return rows.map((fila) => ({
    id: Number(fila.id), // bigint llega como string; los id caben de sobra en un Number
    tabla: fila.tabla,
    operacion: fila.operacion,
    registroId: fila.registro_id,
    antes: fila.antes,
    despues: fila.despues,
    usuarioDb: fila.usuario_db,
    creadoEn: fila.creado_en.toISOString(),
  }));
}
