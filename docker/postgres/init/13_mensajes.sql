-- Mensajes fijos del bot y tiempos en la RÉPLICA DE DESARROLLO.
-- Solo para docker/postgres: en producción el administrador ya creó las tablas, el catálogo, las claves de tiempos
-- y el cambio de eco_contexto(). No correr este archivo allí. Idempotente.

\set ON_ERROR_STOP on
BEGIN;

SET LOCAL ROLE eco_admin;

CREATE TABLE IF NOT EXISTS eco_mensajes_tipos (
  clave       text PRIMARY KEY,
  categoria   text NOT NULL,
  titulo      text NOT NULL,
  descripcion text,
  comodines   text[] NOT NULL DEFAULT '{}',
  varias      boolean NOT NULL DEFAULT true,
  orden       integer NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS eco_mensajes (
  id              serial PRIMARY KEY,
  clave           text NOT NULL REFERENCES eco_mensajes_tipos (clave),
  texto           text NOT NULL CHECK (char_length(texto) BETWEEN 2 AND 1000),
  activo          boolean NOT NULL DEFAULT true,
  orden           integer NOT NULL DEFAULT 100,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por text,
  UNIQUE (clave, texto)
);

CREATE OR REPLACE TRIGGER eco_mensajes_aud AFTER INSERT OR DELETE OR UPDATE ON eco_mensajes
  FOR EACH ROW EXECUTE FUNCTION eco_auditar('id');
CREATE OR REPLACE TRIGGER eco_mensajes_upd BEFORE UPDATE ON eco_mensajes
  FOR EACH ROW EXECUTE FUNCTION eco_set_updated_at();

GRANT SELECT ON eco_mensajes_tipos TO eco_app, eco_n8n;
GRANT SELECT, INSERT, UPDATE, DELETE ON eco_mensajes TO eco_app;
GRANT USAGE ON SEQUENCE eco_mensajes_id_seq TO eco_app;
GRANT SELECT ON eco_mensajes TO eco_n8n;

INSERT INTO eco_mensajes_tipos (clave, categoria, titulo, descripcion, comodines, varias, orden) VALUES
  ('menu_bienvenida', 'Inicio', 'Menú inicial', 'Texto que sigue al saludo en el primer mensaje', ARRAY[]::text[], false, 10),
  ('respuesta_vacia', 'Inicio', 'Respuesta vacía', 'Cuando el bot no logra generar una respuesta', ARRAY[]::text[], true, 20),
  ('asesor_pedir_nombre', 'Asesor', 'Pedir el nombre', 'Antes de pasar con un asesor', ARRAY[]::text[], true, 10),
  ('asesor_con_nombre', 'Asesor', 'Pasar a asesor con nombre', 'Cuando ya tiene el nombre del cliente', ARRAY['nombre']::text[], true, 20),
  ('asesor_sin_nombre', 'Asesor', 'Pasar a asesor sin nombre', 'Cuando el cliente no da su nombre', ARRAY[]::text[], true, 30),
  ('asesor_sin_respuesta_nombre', 'Asesor', 'Sin respuesta al pedir nombre', 'Si el cliente no responde a tiempo', ARRAY[]::text[], true, 40),
  ('asesor_asignado', 'Asesor', 'Asesor asignado', 'Cuando un asesor toma la conversación', ARRAY[]::text[], false, 50),
  ('fuera_de_horario', 'Asesor', 'Fuera de horario', 'Cuando no hay asesores en horario', ARRAY[]::text[], false, 60),
  ('inactividad_aviso', 'Inactividad', 'Aviso de inactividad', 'Cuando el cliente deja de responder', ARRAY['minutos']::text[], true, 10),
  ('inactividad_cierre', 'Inactividad', 'Cierre por inactividad', 'Al cerrar la conversación', ARRAY[]::text[], true, 20),
  ('seguimiento_compra', 'Inactividad', 'Seguimiento de compra', 'A un cliente interesado que dejó de responder', ARRAY[]::text[], true, 30),
  ('seguimiento_asesor', 'Inactividad', 'Ofrecer asesor', 'Después del seguimiento de compra', ARRAY[]::text[], true, 40),
  ('pedido_pedir_numero', 'Atención al cliente', 'Pedir número de pedido', 'Para consultar un pedido', ARRAY[]::text[], true, 10),
  ('dato_no_confirmado_pago', 'Datos no confirmados', 'Dato no confirmado: pago', 'Cuando el bot no puede confirmar ese dato', ARRAY[]::text[], true, 10),
  ('dato_no_confirmado_tiempo', 'Datos no confirmados', 'Dato no confirmado: tiempo', 'Cuando el bot no puede confirmar ese dato', ARRAY[]::text[], true, 20),
  ('dato_no_confirmado_horario', 'Datos no confirmados', 'Dato no confirmado: horario', 'Cuando el bot no puede confirmar ese dato', ARRAY[]::text[], true, 30),
  ('dato_no_confirmado_envio', 'Datos no confirmados', 'Dato no confirmado: envio', 'Cuando el bot no puede confirmar ese dato', ARRAY[]::text[], true, 40),
  ('dato_no_confirmado_contacto', 'Datos no confirmados', 'Dato no confirmado: contacto', 'Cuando el bot no puede confirmar ese dato', ARRAY[]::text[], true, 50),
  ('dato_no_confirmado_pedido', 'Datos no confirmados', 'Dato no confirmado: pedido', 'Cuando el bot no puede confirmar ese dato', ARRAY[]::text[], true, 60),
  ('dato_no_confirmado_general', 'Datos no confirmados', 'Dato no confirmado: general', 'Cuando el bot no puede confirmar ese dato', ARRAY[]::text[], true, 70),
  ('pauta_encabezado_promo', 'Pauta', 'Encabezado con promoción', 'Al presentar una pauta con descuento', ARRAY['pauta','vigencia']::text[], false, 10),
  ('pauta_encabezado', 'Pauta', 'Encabezado', 'Al presentar una pauta sin descuento', ARRAY[]::text[], false, 20),
  ('pauta_cierre_varios', 'Pauta', 'Cierre con varios productos', 'Al final de una pauta con varios productos', ARRAY[]::text[], true, 30),
  ('pauta_cierre_uno', 'Pauta', 'Cierre con un producto', 'Al final de una pauta con un producto', ARRAY[]::text[], true, 40),
  ('pauta_transferir', 'Pauta', 'Transferir desde la pauta', 'Al pasar con un asesor desde una pauta', ARRAY[]::text[], true, 50)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO eco_mensajes (clave, texto, orden, actualizado_por) VALUES
  ('menu_bienvenida', '¿En qué podemos ayudarte hoy? Cuéntame brevemente qué necesitas.', 10, 'semilla-dev'),
  ('asesor_pedir_nombre', '¿Me compartes tu nombre para pasarte con un asesor? 😊', 10, 'semilla-dev'),
  ('asesor_con_nombre', 'Gracias, {nombre}. Te paso con un asesor 🤝', 10, 'semilla-dev'),
  ('inactividad_aviso', '¿Sigues ahí? Si no recibimos respuesta en {minutos} minutos cerraremos la conversación.', 10, 'semilla-dev'),
  ('inactividad_cierre', 'Cerramos la conversación. Escríbenos cuando quieras 💧', 10, 'semilla-dev'),
  ('pauta_encabezado_promo', '*{pauta}*{vigencia}', 10, 'semilla-dev')
ON CONFLICT (clave, texto) DO NOTHING;

INSERT INTO eco_configuracion (clave, valor, tipo, descripcion, actualizado_por) VALUES
  ('segundos_agrupar_saludo', '8', 'entero', 'Segundos para agrupar el saludo', 'semilla-dev'),
  ('minutos_aviso_inactividad', '10', 'entero', 'Minutos sin respuesta para el aviso', 'semilla-dev'),
  ('minutos_cierre_inactividad', '20', 'entero', 'Minutos sin respuesta para cerrar', 'semilla-dev'),
  ('recuperacion_compra_activa', 'true', 'booleano', 'Seguimiento a clientes interesados', 'semilla-dev'),
  ('minutos_asesor_recuperacion', '15', 'entero', 'Minutos para ofrecer asesor tras el seguimiento', 'semilla-dev'),
  ('horas_entre_seguimientos', '24', 'entero', 'Horas mínimas entre seguimientos', 'semilla-dev'),
  ('minutos_repetir_pauta', '30', 'entero', 'Minutos para volver a enviar la pauta', 'semilla-dev'),
  ('horas_repetir_pauta', '24', 'entero', 'Horas para volver a enviar la pauta', 'semilla-dev'),
  ('horas_historial_agente', '24', 'entero', 'Horas de historial que lee el agente', 'semilla-dev')
ON CONFLICT (clave) DO NOTHING;

-- El texto del menú pasó a eco_mensajes (menu_bienvenida).
DELETE FROM eco_configuracion WHERE clave = 'menu_bienvenida_texto';

-- Igual a 10_frases_cierre.sql más 'mensajes': {clave: [textos activos por orden]}.
CREATE OR REPLACE FUNCTION eco_contexto(p_modulo text DEFAULT 'GLOBAL') RETURNS jsonb LANGUAGE sql STABLE AS $function$
  WITH cfg AS (
    SELECT
      COALESCE((SELECT lower(valor) = 'true' FROM eco_configuracion WHERE clave = 'precios_habilitados'), false)     AS precios,
      COALESCE((SELECT lower(valor) = 'true' FROM eco_configuracion WHERE clave = 'promociones_habilitadas'), false) AS promos,
      COALESCE((SELECT valor FROM eco_configuracion WHERE clave = 'moneda'), 'Q')                                     AS moneda
  )
  SELECT jsonb_build_object(
    'generado_en', now(),
    'modulo', upper(p_modulo),
    'precios_habilitados', cfg.precios,
    'promociones_habilitadas', cfg.promos,
    'configuracion', (SELECT COALESCE(jsonb_object_agg(clave, valor), '{}'::jsonb) FROM eco_configuracion),
    'reglas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('codigo', codigo, 'destino', destino, 'categoria', categoria, 'regla', regla) ORDER BY prioridad, id), '[]'::jsonb)
      FROM eco_v_reglas_activas
      WHERE modulo IN ('GLOBAL', upper(p_modulo))
    ),
    'catalogo', (
      SELECT COALESCE(jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'codigo', c.codigo, 'nombre', c.nombre, 'tipo', c.tipo, 'familia', c.familia,
          'capacidad_litros', c.capacidad_litros, 'colores', c.colores, 'estado', c.estado,
          'precio_base',   CASE WHEN cfg.precios AND c.precio_base IS NOT NULL THEN c.precio_base END,
          'descuento_pct', CASE WHEN cfg.precios AND cfg.promos AND c.descuento_vigente_pct > 0 THEN c.descuento_vigente_pct END,
          'precio_final',  CASE WHEN cfg.precios AND c.precio_base IS NOT NULL
                                THEN round(c.precio_base * (1 - (CASE WHEN cfg.promos THEN c.descuento_vigente_pct ELSE 0 END) / 100.0), 2) END,
          'moneda',        CASE WHEN cfg.precios AND c.precio_base IS NOT NULL THEN cfg.moneda END,
          'pauta',         CASE WHEN cfg.promos AND c.descuento_vigente_pct > 0 THEN c.pauta_nombre END,
          'palabras_clave', c.palabras_clave,
          'descripcion_corta', NULLIF(btrim(c.descripcion_corta), ''),
          'descripcion',       NULLIF(btrim(c.descripcion), ''),
          'caracteristicas',   NULLIF(c.caracteristicas, '{}'),
          'material',          NULLIF(btrim(c.material), ''),
          'capacidad_texto',   NULLIF(btrim(c.capacidad_texto), ''),
          'capacidad_purificador_litros', c.capacidad_purificador_litros,
          'tasa_filtrado',     NULLIF(btrim(c.tasa_filtrado), ''),
          'ancho_cm', c.ancho_cm, 'alto_cm', c.alto_cm, 'largo_cm', c.largo_cm, 'peso_lb', c.peso_lb,
          'compatible_con',    NULLIF(btrim(c.compatible_con), ''),
          'url_web',           NULLIF(btrim(c.url_web), '')
        )) ORDER BY c.orden, c.id), '[]'::jsonb)
      FROM eco_v_catalogo c
    ),
    'pautas', CASE WHEN cfg.promos THEN (
      SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'codigo', pa.codigo, 'nombre', pa.nombre, 'mensaje', pa.mensaje_cliente,
        'descuento_pct', pa.descuento_pct, 'vigente_hasta', pa.vigente_hasta,
        'imagenes', (SELECT jsonb_agg(m.hubspot_file_id ORDER BY m.orden)
                     FROM eco_multimedia_pautas mp JOIN eco_multimedia m ON m.id = mp.multimedia_id
                     WHERE mp.pauta_id = pa.id AND m.activo)
      )) ORDER BY pa.id), '[]'::jsonb)
      FROM eco_pautas pa
      WHERE pa.activo
        AND (pa.vigente_desde IS NULL OR pa.vigente_desde <= now())
        AND (pa.vigente_hasta IS NULL OR pa.vigente_hasta >  now())
    ) ELSE '[]'::jsonb END,
    'mensajes', (
      SELECT COALESCE(jsonb_object_agg(clave, textos), '{}'::jsonb)
      FROM (SELECT clave, jsonb_agg(texto ORDER BY orden, id) AS textos
            FROM eco_mensajes WHERE activo GROUP BY clave) m
    ),
    'frases_cierre', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('modulo', f.modulo, 'situacion', f.situacion, 'frase', f.frase)
                                ORDER BY f.orden, f.id), '[]'::jsonb)
      FROM eco_frases_cierre f
      WHERE f.activo AND f.modulo IN ('GLOBAL', upper(p_modulo))
    ),
    'multimedia', (
      SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'tipo', m.tipo, 'file_id', m.hubspot_file_id, 'descripcion', m.descripcion,
        'producto', p.codigo, 'color', m.color, 'tema', m.tema
      )) ORDER BY m.tipo, m.orden, m.id), '[]'::jsonb)
      FROM eco_multimedia m
      LEFT JOIN eco_productos p ON p.id = m.producto_id
      WHERE m.activo AND m.tipo IN ('imagen','video')
    )
  )
  FROM cfg;
$function$;

COMMIT;
