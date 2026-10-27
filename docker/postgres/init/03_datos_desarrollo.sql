-- Datos FICTICIOS solo para desarrollo local. Nunca se cargan en producción.
-- Las claves y tipos de eco_configuracion son los reales (2026-10-26); los valores son de prueba.
-- Idempotente: se puede volver a correr sin duplicar.

INSERT INTO eco_configuracion (clave, valor, tipo, descripcion, actualizado_por) VALUES
  ('bandeja_compras',          'dev-bandeja-compras',      'texto',    'Bandeja para compras de hogar.', 'semilla-dev'),
  ('bandeja_corporativos',     'dev-bandeja-corporativos', 'texto',    'Bandeja para compras de oficina o empresa.', 'semilla-dev'),
  ('bandeja_sac',              'dev-bandeja-sac',          'texto',    'Bandeja para atención al cliente.', 'semilla-dev'),
  ('hubspot_inbox_bot',        'dev-inbox',                'texto',    'Bandeja (inbox) de HubSpot que atiende el bot.', 'semilla-dev'),
  ('hubspot_sender_actor_id',  'dev-actor',                'texto',    'Actor de HubSpot que envía los mensajes del bot.', 'semilla-dev'),
  ('id_menu_esperando_nombre', '0',                        'entero',   'id_menu que usan los flujos mientras esperan el nombre del cliente.', 'semilla-dev'),
  ('max_fotos_por_respuesta',  '3',                        'entero',   'Máximo de fotos por respuesta.', 'semilla-dev'),
  ('minutos_espera_nombre',    '5',                        'entero',   'Minutos antes de transferir sin nombre (flujo Esperando_nombre_enviar_a_bandeja).', 'semilla-dev'),
  ('moneda',                   'Q',                        'texto',    'Símbolo de moneda para mostrar precios.', 'semilla-dev'),
  ('precios_habilitados',      'false',                    'booleano', 'Si es true, el bot puede dar precios del catálogo. Lo autoriza Comercial. Si es false, cualquier consulta de precio pasa a un asesor.', 'semilla-dev'),
  ('promociones_habilitadas',  'false',                    'booleano', 'Si es true, el bot puede mencionar descuentos y pautas vigentes.', 'semilla-dev'),
  ('segundos_entre_fotos',     '2',                        'entero',   'Pausa entre fotos para que WhatsApp las entregue en orden.', 'semilla-dev')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO eco_pautas (codigo, nombre, mensaje_cliente, descuento_pct, vigente_desde, vigente_hasta, actualizado_por) VALUES
  ('DEV-VIGENTE', 'Pauta de prueba vigente', 'Mensaje de prueba', 20, now() - interval '1 day', now() + interval '30 days', 'semilla-dev'),
  ('DEV-VENCIDA', 'Pauta de prueba vencida', 'Mensaje de prueba', 30, now() - interval '60 days', now() - interval '1 day', 'semilla-dev')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO eco_productos (codigo, nombre, tipo, familia, capacidad_litros, colores, precio_base, descuento_pct, pauta_id, palabras_clave, orden, actualizado_por) VALUES
  ('DEV-EQ-1',  'Equipo de prueba 1',    'equipo',    'prueba-equipos',    20, '{azul,blanco}', 500.00, 0,  NULL, '{filtro,prueba}', 10, 'semilla-dev'),
  ('DEV-EQ-2',  'Equipo de prueba 2',    'equipo',    'prueba-equipos',    10, '{verde}',       350.00, 10, (SELECT id FROM eco_pautas WHERE codigo = 'DEV-VIGENTE'), '{}', 20, 'semilla-dev'),
  ('DEV-EQ-3',  'Equipo de prueba 3',    'equipo',    'prueba-equipos',    NULL, '{}',          800.00, 15, (SELECT id FROM eco_pautas WHERE codigo = 'DEV-VENCIDA'), '{}', 30, 'semilla-dev'),
  ('DEV-AC-1',  'Accesorio de prueba',   'accesorio', 'prueba-accesorios', NULL, '{}',          NULL,   0,  NULL, '{}', 40, 'semilla-dev'),
  ('DEV-RE-1',  'Repuesto de prueba',    'repuesto',  'prueba-repuestos',  NULL, '{}',          95.50,  0,  NULL, '{}', 50, 'semilla-dev')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO eco_multimedia (tipo, hubspot_file_id, descripcion, producto_id, color, tema, pauta_id, orden, actualizado_por) VALUES
  ('imagen',    'DEV-FILE-1', 'Foto de prueba del equipo 1 en azul', (SELECT id FROM eco_productos WHERE codigo = 'DEV-EQ-1'), 'azul', NULL, NULL, 10, 'semilla-dev'),
  ('video',     'DEV-FILE-2', 'Video de prueba de instalación',       NULL, NULL, 'instalacion', NULL, 20, 'semilla-dev'),
  ('promocion', 'DEV-FILE-3', 'Arte de prueba de la pauta vigente',   NULL, NULL, NULL, (SELECT id FROM eco_pautas WHERE codigo = 'DEV-VIGENTE'), 10, 'semilla-dev'),
  ('promocion', 'DEV-FILE-4', 'Arte de prueba sin pauta (el bot no lo ve)', NULL, NULL, NULL, NULL, 20, 'semilla-dev')
ON CONFLICT (tipo, hubspot_file_id) DO NOTHING;

INSERT INTO eco_reglas_bot (codigo, modulo, destino, categoria, titulo, regla, prioridad, actualizado_por) VALUES
  ('DEV-R-GLOBAL', 'GLOBAL', 'TODOS',     'prueba', 'Regla global de prueba', 'Texto de prueba para todos los módulos.', 10, 'semilla-dev'),
  ('DEV-R-SAC',    'SAC',    'REDACTOR',  'prueba', 'Regla SAC de prueba',    'Texto de prueba solo para SAC.',          20, 'semilla-dev'),
  ('DEV-R-COMPRA', 'COMPRA', 'ENRUTADOR', 'prueba', 'Regla COMPRA de prueba', 'Texto de prueba solo para COMPRA.',       30, 'semilla-dev')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO eco_preguntas_frecuentes (numero, pregunta, tema, palabras_clave, respuesta, modulos, orden, actualizado_por) VALUES
  (1, '¿Pregunta de prueba 1?', 'prueba', '{prueba}', 'Respuesta de prueba 1.', '{GLOBAL}', 10, 'semilla-dev'),
  (2, '¿Pregunta de prueba 2?', 'prueba', '{}',       'Respuesta de prueba 2.', '{SAC,COMPRA}', 20, 'semilla-dev')
ON CONFLICT (numero) DO NOTHING;
