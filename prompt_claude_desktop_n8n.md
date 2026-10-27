# Acoplar el bot de WhatsApp (n8n) a la base de datos de gestión de Ecofiltro

Tienes acceso a mi instancia de n8n. Ahí corre el bot de WhatsApp de Ecofiltro (n8n + HubSpot). Necesito que el bot
lea su configuración, reglas, catálogo, precios, promociones, preguntas frecuentes y multimedia **desde la base de
datos**, en lugar de tenerlos escritos dentro de los flujos. Así, lo que el equipo cambie en la app de gestión se
aplica en el **siguiente mensaje** de cada cliente, sin tocar n8n.

## Forma de trabajar (importante)

1. **Primero solo lee e informa.** Haz el inventario y el plan (sección "Entregable 1") y **espera mi aprobación**
   antes de cambiar cualquier cosa.
2. **No modifiques ni actives flujos en producción.** Trabaja sobre **copias** de los flujos (sufijo `[DB]`), inactivas.
   Antes de cambiar nada, exporta el JSON de cada flujo original como respaldo.
3. **No escribas en las tablas `eco_*`**: las administra la app. El bot solo las lee.
4. **No modifiques la estructura de la base** (tablas, vistas, funciones, permisos).
5. Si algo no está claro (qué módulo corresponde a un flujo, qué hacer sin precio…), **pregúntame**, no supongas.

## La base de datos

PostgreSQL 18, base `ecofiltro_bot`. Para el bot existe el rol **`eco_n8n`** (solo `SELECT` sobre las tablas y vistas
`eco_*` y `EXECUTE` sobre `eco_contexto`). Usa una credencial de PostgreSQL en n8n con ese usuario; nunca con
un usuario administrador.

### Fuente principal: `eco_contexto(modulo)`

Una sola llamada devuelve todo lo que el bot necesita, ya filtrado y con las reglas comerciales aplicadas:

```sql
SELECT eco_contexto($1) AS contexto;   -- $1 = 'SAC' | 'COMPRA' | 'DISTRIBUIDOR' | 'PAUTAS' | 'GLOBAL'
```

Devuelve un JSON:

| Clave                     | Contenido                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `precios_habilitados`     | `true` si el bot puede dar precios. Si es `false`, **cualquier consulta de precio pasa a un asesor**.                                                                           |
| `promociones_habilitadas` | `true` si el bot puede mencionar descuentos y pautas.                                                                                                                           |
| `configuracion`           | Objeto `{ clave: valor }` con todas las claves (ver abajo). Los valores son texto.                                                                                              |
| `reglas`                  | `[{ codigo, destino, categoria, regla }]`, ya ordenadas por prioridad. Incluye las `GLOBAL` + las del módulo.                                                                   |
| `catalogo`                | `[{ codigo, nombre, tipo, familia, capacidad_litros, colores, estado, palabras_clave, precio_base?, descuento_pct?, precio_final?, moneda?, pauta? }]`. Solo productos activos. |
| `pautas`                  | `[{ codigo, nombre, mensaje, descuento_pct, vigente_hasta, imagenes: [file_id…] }]`. Vacío si las promociones están apagadas.                                                   |
| `multimedia`              | `[{ tipo: 'imagen'                                                                                                                                                              | 'video', file_id, descripcion, producto, color, tema }]`. `file_id` es el ID de archivo de HubSpot. |

Reglas que el bot debe respetar al usar el catálogo:

- **Si un producto no trae `precio_final`, el bot no da precio** (precios apagados o producto sin precio). Nunca
  inventar ni calcular precios: `precio_final` ya viene calculado por la base.
- `descuento_pct` y `pauta` solo vienen cuando las promociones están encendidas y hay descuento vigente.
- `codigo` es el **ItemCode** del producto (ej. `COLORS-22`, `MAZARI-30`).
- `estado` puede ser `disponible`, `agotado` o `descontinuado`.

Sobre las reglas:

- `destino` indica qué agente las usa: `ENRUTADOR` (decide a qué flujo va el cliente), `REDACTOR` (redacta la
  respuesta) o `TODOS`. Cada agente debe recibir solo las suyas + las `TODOS`.
- El texto de `regla` es la instrucción tal cual; va al prompt del agente correspondiente.

Claves de `configuracion` que hoy existen (si alguna está escrita a mano en un flujo, debe leerse de aquí):

`bandeja_compras`, `bandeja_corporativos`, `bandeja_sac`, `hubspot_inbox_bot`, `hubspot_sender_actor_id`,
`id_menu_esperando_nombre`, `max_fotos_por_respuesta`, `minutos_espera_nombre`, `moneda`, `precios_habilitados`,
`promociones_habilitadas`, `segundos_entre_fotos`.

### Preguntas frecuentes (no vienen en `eco_contexto`)

```sql
SELECT numero, pregunta, tema, palabras_clave, respuesta
FROM eco_v_preguntas_frecuentes
WHERE modulos && ARRAY['GLOBAL', $1]::text[];   -- $1 = módulo del flujo
```

La vista ya devuelve solo las activas, ordenadas.

### Horarios de agentes (reemplaza la lógica de horario escrita en n8n)

Cada agente (`hubspot_agentes.id`) tiene su horario por día de la semana y sus días de descanso, que el equipo
administra desde la app. Los flujos **ya no deben** usar `hubspot_agentes.hora_inicio / hora_fin` ni reglas de días
escritas a mano (hoy existen avisos como `fuera_de_horario_lunes_viernes`, `_sabado`, `_domingo`).

```sql
-- ¿Este agente está en horario ahora? (hora de Guatemala; un día de descanso gana sobre el horario)
SELECT eco_agente_en_horario($1);              -- $1 = hubspot_agentes.id → true / false

-- Agentes en horario ahora, para repartir conversaciones (filtrar además por bandeja y estado_agente)
SELECT id, actor_id, nombre, apellido, email, bandeja, canal, estado_agente, limite_chats
FROM eco_v_agentes_en_horario
WHERE bandeja = $1 AND estado_agente = 'activo';
```

Si nadie de la bandeja está en horario, es "fuera de horario": el flujo debe enviar el aviso que ya usa. Antes de
cambiar algo, identifica en el inventario **dónde** se decide hoy si es horario hábil y propón el reemplazo.

### Varias pautas por producto

Un producto puede tener varias pautas. Para el bot no cambia nada: `eco_contexto()` sigue entregando en cada producto
`descuento_pct`, `precio_final` y `pauta` (la pauta vigente con mayor descuento) con la misma forma.

### Buenas prácticas en los nodos PostgreSQL de n8n

- **Consultas parametrizadas** (`$1` + "Query Parameters"). Nunca concatenar texto del cliente en el SQL.
- **Leer en cada mensaje**, sin guardar en caché: es lo que hace que un cambio en la app se aplique de inmediato.
  `eco_contexto` es rápida (una sola consulta).
- Si la consulta falla, el bot debe pasar la conversación a un asesor en lugar de responder sin datos.

## Entregable 1: inventario y plan (sin cambiar nada)

Para cada flujo del bot:

1. Nombre, si está activo y qué hace (SAC, compras, distribuidores, pautas, enrutador…).
2. Qué datos tiene **escritos a mano** que deberían venir de la base: precios, descuentos, lista de productos,
   reglas o instrucciones en prompts, preguntas frecuentes, IDs de archivos de HubSpot, bandejas, tiempos, IDs de menú,
   **horarios de atención y días hábiles**.
3. Qué consultas a PostgreSQL hace hoy (tablas y SQL), y con qué credencial/usuario.
4. Qué módulo (`SAC`, `COMPRA`, `DISTRIBUIDOR`, `PAUTAS`) le corresponde.
5. Cambios propuestos, nodo por nodo, y cualquier diferencia entre lo escrito a mano y lo que hay en la base
   (por ejemplo, un precio distinto o una regla que no existe en `eco_reglas_bot`).

Termina con la lista de preguntas que necesites que yo responda. **Espera mi aprobación.**

## Entregable 2: implementación (después de mi aprobación)

- Copias `[DB]` de los flujos, inactivas, con los cambios aprobados.
- Cómo probarlas sin afectar clientes reales.
- Para verificar, la app de gestión tiene una pantalla "¿Qué ve el bot?" que muestra exactamente lo que devuelve
  `eco_contexto(modulo)`: el bot debería comportarse según eso.
- Al final, un resumen de qué cambió en cada flujo y cómo volver atrás (los JSON de respaldo).
