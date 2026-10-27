// Fragmentos SQL de vigencia, con la misma condición que usan eco_v_catalogo, eco_v_reglas_activas
// y eco_contexto(): activo y now() dentro de [vigente_desde, vigente_hasta); fechas nulas = sin límite.
// `t` es el alias de la tabla en la consulta (constante del código, nunca texto del usuario).

export const vigenteSql = (t) =>
  `(${t}.activo AND (${t}.vigente_desde IS NULL OR ${t}.vigente_desde <= now())
               AND (${t}.vigente_hasta IS NULL OR ${t}.vigente_hasta > now()))`;

export const estadoVigenciaSql = (t) =>
  `CASE WHEN NOT ${t}.activo THEN 'inactiva'
        WHEN ${t}.vigente_desde > now() THEN 'programada'
        WHEN ${t}.vigente_hasta <= now() THEN 'vencida'
        ELSE 'vigente' END`;
