// SQL de eco_preguntas_frecuentes.

const SELECT_PREGUNTA = `
  SELECT id, numero, pregunta, tema, palabras_clave, respuesta, modulos, orden, activo,
         actualizado_en, actualizado_por, actualizado_en::text AS version
  FROM eco_preguntas_frecuentes`;

function aPregunta(fila) {
  return {
    id: fila.id,
    numero: fila.numero,
    pregunta: fila.pregunta,
    tema: fila.tema,
    palabrasClave: fila.palabras_clave,
    respuesta: fila.respuesta,
    modulos: fila.modulos,
    orden: fila.orden,
    activo: fila.activo,
    actualizadoEn: fila.actualizado_en.toISOString(),
    actualizadoPor: fila.actualizado_por,
    version: fila.version,
  };
}

// Mismo orden que eco_v_preguntas_frecuentes.
export async function listar(db) {
  const { rows } = await db.query(`${SELECT_PREGUNTA} ORDER BY orden, numero`);
  return rows.map(aPregunta);
}

export async function obtenerPorId(db, id) {
  const { rows } = await db.query(`${SELECT_PREGUNTA} WHERE id = $1`, [id]);
  return rows[0] ? aPregunta(rows[0]) : null;
}

export async function siguienteNumero(db) {
  const { rows } = await db.query(
    `SELECT COALESCE(max(numero), 0) + 1 AS siguiente FROM eco_preguntas_frecuentes`,
  );
  return rows[0].siguiente;
}

export async function insertar(db, datos, actualizadoPor) {
  const { rows } = await db.query(
    `INSERT INTO eco_preguntas_frecuentes
       (numero, pregunta, tema, palabras_clave, respuesta, modulos, orden, activo, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      datos.numero,
      datos.pregunta,
      datos.tema,
      datos.palabrasClave,
      datos.respuesta,
      datos.modulos,
      datos.orden,
      datos.activo,
      actualizadoPor,
    ],
  );
  return rows[0].id;
}

export async function obtenerEditableBloqueando(db, id) {
  const { rows } = await db.query(
    `SELECT pregunta, tema, palabras_clave, respuesta, modulos, orden, activo,
            actualizado_en::text AS version
     FROM eco_preguntas_frecuentes WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    pregunta: fila.pregunta,
    tema: fila.tema,
    palabrasClave: fila.palabras_clave,
    respuesta: fila.respuesta,
    modulos: fila.modulos,
    orden: fila.orden,
    activo: fila.activo,
    version: fila.version,
  };
}

export async function actualizar(db, id, datos, actualizadoPor) {
  await db.query(
    `UPDATE eco_preguntas_frecuentes
     SET pregunta = $2, tema = $3, palabras_clave = $4, respuesta = $5, modulos = $6, orden = $7,
         activo = $8, actualizado_por = $9
     WHERE id = $1`,
    [
      id,
      datos.pregunta,
      datos.tema,
      datos.palabrasClave,
      datos.respuesta,
      datos.modulos,
      datos.orden,
      datos.activo,
      actualizadoPor,
    ],
  );
}
