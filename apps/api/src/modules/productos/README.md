# Módulo productos

Catálogo que el bot ofrece (`eco_productos`), con el precio final que calcula igual que `eco_contexto()`.

- **Tablas:** `eco_productos` (lectura, `INSERT` y `UPDATE`), `eco_productos_pautas`; lectura de `eco_pautas`,
  `eco_v_catalogo`, `eco_multimedia` (colores con foto, dependencias) y de los textos donde se busca el ItemCode
  (`eco_reglas_bot.regla`, `eco_preguntas_frecuentes.respuesta`, `eco_mensajes.texto`, `eco_productos.compatible_con`).
- **Endpoints:**
  - `GET /api/productos` y `GET /api/productos/:id` (cualquier rol).
  - `POST /api/productos` (permiso `productos:editar`): producto nuevo. Obligatorios `codigo`, `nombre`, `tipo`,
    `familia`, `estado`, `activo`; `precioBase` salvo «descontinuado». 409 `CODIGO_DUPLICADO` con el producto que choca.
  - `GET /api/productos/:id/impacto-codigo?codigo=` (permiso `productos:editar`): `{ conflicto, dependencias,
menciones }` antes de cambiar el ItemCode.
  - `PUT /api/productos/:id` (permiso `productos:editar`) con todos los campos editables + `version`.
  - `PATCH /api/productos/:id/activo` `{ activo, version }` (permiso `productos:editar`).
- **ItemCode:** es la columna `codigo`. El bot lo usa para nombrar el producto (`[[PRECIO:CODIGO]]`, fotos, pautas).
  - Uno nuevo se normaliza (`itemCode`: mayúsculas, sin espacios, solo `A-Z 0-9 - .`). Uno viejo fuera de ese
    formato se puede seguir guardando tal cual mientras no cambie.
  - Único sin importar mayúsculas, también contra inactivos (consulta + índice `upper(codigo)` de `docs/sql/005`).
  - Cambiarlo exige `confirmarCambioCodigo: true` (400 `CONFIRMAR_CAMBIO_CODIGO`): la web muestra antes el impacto.
    Las filas que apuntan por `producto_id` no se rompen; los textos que escriben el código viejo sí, y se listan.
    El historial (`eco_auditoria`) guarda el código anterior. `eventos` no se toca.
- **Variante y nombre corto:** `variante` («Flor Azul») y `nombreCorto` («Cerámica Flor Azul»; vacío = `nombre`).
- **Avisos** (`avisosProducto` en `@ecofiltro/shared/ficha.js`, no bloquean): activo y disponible sin precio,
  descontinuado activo, color sin foto activa (`coloresConFoto`), descripción con un color que no está en `colores`.
- **Campos editables:** `codigo`, `variante`, `nombreCorto`, `precioBase`, `descuentoPct`, `estado`, `colores`, `palabrasClave`, `pautaIds` (varias pautas), `orden`, `activo`
  y la **ficha** (`CAMPOS_FICHA` de `@ecofiltro/shared`): `descripcionCorta`, `descripcion`, `caracteristicas`, `material`,
  `capacidadTexto`, `capacidadPurificadorLitros`, `tasaFiltrado`, `anchoCm`, `altoCm`, `largoCm`, `pesoLb`, `compatibleCon`, `urlWeb`.
  Identificación por imagen (`CAMPOS_VISION`): `pistasVisuales` y `fotosReferencia` (`[{ url, color }]`).
  El `PUT` reemplaza todos los campos: los de la ficha son obligatorios en el cuerpo (con `null` / `[]` si están vacíos).
  Código, nombre, tipo, familia, capacidad y `woo_id` son de solo lectura. No hay alta ni borrado.
- **Reglas:**
  - Validación en `@ecofiltro/shared` (`esquemaEditarProducto`): descuento 0–100, precio ≥ 0, máximo 2 decimales,
    listas sin vacíos ni repetidos.
  - Ficha: medidas y peso positivos con 1 decimal, URL que empiece con `https://ecofiltro.com.gt/`, textos sin HTML,
    hasta 12 características de 200 caracteres. Sin características se guarda `NULL` (no llega al bot).
  - **Campos por tipo (en el service):** `capacidadPurificadorLitros` solo en equipos y repuestos; `compatibleCon`
    solo en repuestos y accesorios. Si no aplica → 400 `CAMPO_NO_APLICA` (`TIPOS_POR_CAMPO` en `@ecofiltro/shared/ficha.js`).
  - Identificación por imagen (`@ecofiltro/shared/vision.js`): solo equipos y repuestos (`CAMPO_NO_APLICA`), pistas
    hasta 600 caracteres sin HTML, hasta 6 fotos con URL `https://` y sin repetir. `fotos_referencia` se guarda como
    jsonb; si estaba en `NULL` y sigue sin fotos, queda en `NULL` (no anota un cambio falso en la auditoría).
  - `descuentoVigentePct` viene de `eco_v_catalogo`. Con una pauta inactiva o vencida es **0**, aunque el producto
    tenga su propio descuento: la web lo advierte.
  - `precioFinal` = `calcularPrecioFinal(precioBase, descuentoVigentePct)` (`@ecofiltro/shared/precios.js`).
    Una prueba de integración verifica que coincide con el `round()` de PostgreSQL.
  - **Concurrencia optimista:** si `version` no coincide (otra persona guardó antes) → 409 `CONFLICTO_VERSION`.
  - Guardar sin cambios no hace `UPDATE` (no genera auditoría vacía).
  - `actualizado_por` = correo del usuario; la auditoría la escribe el trigger `eco_productos_aud`.
