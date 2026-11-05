// SQL de gestion.historial_sesiones y gestion.eventos_usuarios.
// Rango de fechas en hora de Guatemala: [desde 00:00, hasta + 1 día 00:00).

const RANGO = `($1::date)::timestamp AT TIME ZONE 'America/Guatemala'`;
const RANGO_FIN = `($2::date + 1)::timestamp AT TIME ZONE 'America/Guatemala'`;

export async function registrarEvento(db, { usuarioId, correo, evento, detalle, hechoPor, ip }) {
  await db.query(
    `INSERT INTO gestion.eventos_usuarios (usuario_id, correo, evento, detalle, hecho_por, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuarioId ?? null, correo, evento, detalle ?? null, hechoPor ?? null, ip ?? null],
  );
}

// Sesiones con su estado calculado: una sesión sin `fin` sigue abierta mientras exista y no venza;
// si no, se dejó la app abierta y terminó en su última actividad.
const SESIONES = `
  SELECT h.id, h.usuario_id, u.nombre, u.correo, h.inicio, h.ip, h.navegador,
         CASE WHEN h.fin IS NOT NULL THEN h.motivo_fin
              WHEN s.historial_id IS NOT NULL THEN 'abierta'
              ELSE 'expirada' END AS motivo,
         COALESCE(h.fin, h.ultima_actividad) AS fin,
         (h.fin IS NULL AND s.historial_id IS NOT NULL
          AND h.ultima_actividad > now() - make_interval(mins => $4)) AS en_linea
  FROM gestion.historial_sesiones h
  JOIN gestion.usuarios u ON u.id = h.usuario_id
  LEFT JOIN LATERAL (
    SELECT historial_id FROM gestion.sesiones
    WHERE historial_id = h.id AND expira_en > now() LIMIT 1
  ) s ON true
  WHERE h.inicio < ${RANGO_FIN}
    AND COALESCE(h.fin, h.ultima_actividad) >= ${RANGO}
    AND ($3::int IS NULL OR h.usuario_id = $3)`;

const minutos = (inicio, fin) => Math.max(0, Math.floor((fin - inicio) / 60_000));

export async function listarSesiones(db, { desde, hasta, usuarioId, minutosEnLinea }) {
  const { rows } = await db.query(`${SESIONES} ORDER BY h.inicio DESC LIMIT 500`, [
    desde,
    hasta,
    usuarioId ?? null,
    minutosEnLinea,
  ]);
  return rows.map((f) => ({
    id: Number(f.id),
    usuarioId: f.usuario_id,
    nombre: f.nombre,
    correo: f.correo,
    inicio: f.inicio.toISOString(),
    fin: f.fin.toISOString(),
    minutos: minutos(f.inicio, f.fin),
    motivo: f.motivo,
    enLinea: f.en_linea,
    ip: f.ip,
    navegador: f.navegador,
  }));
}

// Totales por usuario en el rango (todos los usuarios, aunque no hayan entrado).
export async function resumir(db, { desde, hasta, usuarioId, minutosEnLinea }) {
  const { rows } = await db.query(
    `WITH s AS (${SESIONES}),
          f AS (SELECT usuario_id, count(*)::int AS fallidos FROM gestion.eventos_usuarios
                WHERE evento = 'acceso_fallido' AND creado_en >= ${RANGO} AND creado_en < ${RANGO_FIN}
                GROUP BY usuario_id)
     SELECT u.id, u.nombre, u.correo,
            count(s.id)::int AS sesiones,
            COALESCE(sum(extract(epoch FROM s.fin - s.inicio)) / 60, 0)::int AS minutos,
            min(s.inicio) AS primera_entrada, max(s.fin) AS ultima_salida,
            COALESCE(max(f.fallidos), 0)::int AS fallidos,
            COALESCE(bool_or(s.en_linea), false) AS en_linea
     FROM gestion.usuarios u
     LEFT JOIN s ON s.usuario_id = u.id
     LEFT JOIN f ON f.usuario_id = u.id
     WHERE ($3::int IS NULL OR u.id = $3)
     GROUP BY u.id
     ORDER BY en_linea DESC, ultima_salida DESC NULLS LAST, u.nombre`,
    [desde, hasta, usuarioId ?? null, minutosEnLinea],
  );
  return rows.map((f) => ({
    usuarioId: f.id,
    nombre: f.nombre,
    correo: f.correo,
    sesiones: f.sesiones,
    minutos: f.minutos,
    primeraEntrada: f.primera_entrada?.toISOString() ?? null,
    ultimaSalida: f.ultima_salida?.toISOString() ?? null,
    fallidos: f.fallidos,
    enLinea: f.en_linea,
  }));
}

export async function listarEventos(db, { desde, hasta, usuarioId }) {
  const { rows } = await db.query(
    `SELECT e.id, e.usuario_id, u.nombre, e.correo, e.evento, e.detalle, e.hecho_por, e.ip, e.creado_en
     FROM gestion.eventos_usuarios e
     LEFT JOIN gestion.usuarios u ON u.id = e.usuario_id
     WHERE e.creado_en >= ${RANGO} AND e.creado_en < ${RANGO_FIN}
       AND ($3::int IS NULL OR e.usuario_id = $3)
     ORDER BY e.creado_en DESC, e.id DESC
     LIMIT 500`,
    [desde, hasta, usuarioId ?? null],
  );
  return rows.map((f) => ({
    id: Number(f.id),
    usuarioId: f.usuario_id,
    nombre: f.nombre,
    correo: f.correo,
    evento: f.evento,
    detalle: f.detalle,
    hechoPor: f.hecho_por,
    ip: f.ip,
    creadoEn: f.creado_en.toISOString(),
  }));
}
