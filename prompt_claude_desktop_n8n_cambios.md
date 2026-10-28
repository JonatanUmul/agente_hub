# Cambios en la base del bot: horarios de agentes y varias pautas por producto y por multimedia

Tienes acceso a mi n8n, donde corre el bot de WhatsApp de Ecofiltro (n8n + HubSpot + PostgreSQL `ecofiltro_bot`).
El 27 de octubre de 2026 aplicamos en producción cambios en la base de datos. Desde ahora, los horarios de los agentes
se administran en la app de gestión. **Necesito que los flujos de n8n usen esos horarios** en lugar de la lógica de
horario que tienen escrita a mano.

## Forma de trabajar (importante)

1. **Primero solo lee e informa** (sección "Entregable 1") y **espera mi aprobación** antes de cambiar nada.
2. **No modifiques ni actives flujos en producción.** Trabaja sobre copias inactivas con sufijo `[DB]` y exporta antes
   el JSON de cada flujo original como respaldo.
3. **No escribas en ninguna tabla nueva** (el bot solo las lee) y **no modifiques la estructura de la base**.
4. Usa la credencial de PostgreSQL con el usuario **`eco_n8n`** (ya tiene permiso de lectura sobre todo lo nuevo).
   Consultas siempre parametrizadas (`$1` + "Query Parameters").
5. Si algo no está claro, **pregúntame**.

## 1. Horarios de agentes (esto sí requiere cambios en n8n)

### Cómo era

- Cada agente tenía un solo rango en `hubspot_agentes.hora_inicio` / `hora_fin` (ej. 08:00–17:00), sin días.
- La regla de qué días se atiende está escrita dentro de n8n: los avisos registrados en `agent_hours_notice_control`
  usan motivos como `fuera_de_horario_lunes_viernes`, `fuera_de_horario_sabado`, `fuera_de_horario_domingo`.

### Cómo es ahora

- `eco_agentes_horario`: por agente, uno o varios rangos **por día de la semana** (ISO: 1 = lunes … 7 = domingo).
  Un día sin rangos = el agente descansa ese día.
- `eco_agentes_descanso`: fechas en que el agente no atiende (vacaciones, día libre). Ganan sobre el horario semanal.
- Ya están cargados: cada agente quedó con su horario anterior de **lunes a viernes**; el equipo ajusta el resto en la app.
- Todo se calcula en **hora de Guatemala** dentro de la base: no depende de la zona horaria de n8n.

### Qué consultar

```sql
-- ¿Este agente está en horario ahora? → true / false
SELECT eco_agente_en_horario($1) AS en_horario;          -- $1 = hubspot_agentes.id

-- Agentes en horario ahora (para repartir conversaciones)
SELECT id, actor_id, nombre, apellido, email, bandeja, canal, estado_agente, limite_chats
FROM eco_v_agentes_en_horario
WHERE bandeja = $1 AND estado_agente = 'activo';          -- $1 = bandeja (SAC, televentas, corporativos, regiones…)
```

`eco_v_agentes_en_horario` ya excluye agentes archivados y los que están fuera de horario o descansando.

### Qué hay que cambiar

1. Toda decisión de "¿es horario hábil?" o "¿este agente puede recibir la conversación?" debe salir de las consultas de
   arriba. Dejar de usar `hubspot_agentes.hora_inicio` / `hora_fin` y las reglas de días escritas en los nodos.
2. La rotación o asignación de agentes (por ejemplo, con `estado_rotacion_agentes`) solo debe considerar agentes que
   aparezcan en `eco_v_agentes_en_horario`.
3. Si **ningún** agente de la bandeja está en horario → es "fuera de horario": conserva el aviso que ya se envía hoy,
   su texto y el control para no repetirlo (`agent_hours_notice_control`). Solo cambia **cómo se decide** que es fuera
   de horario. Si los motivos por día (`_lunes_viernes`, `_sabado`, `_domingo`) se usan para elegir el texto del
   aviso, mantenlos calculados por el día de la semana (hora de Guatemala).
4. No borres ni dejes de llenar `hubspot_agentes.hora_inicio` / `hora_fin` si algún flujo los sincroniza: la app ya
   no los usa, pero no queremos romper nada.

## 2. Varias pautas por producto (no debería requerir cambios)

Un producto ahora puede tener varias pautas (tabla `eco_productos_pautas`). Se aplica el mayor descuento entre el propio
y el de sus pautas vigentes, y las pautas vencidas ya no anulan el descuento propio.

**Para el bot no cambia la forma de los datos:** `eco_contexto(modulo)` sigue entregando en cada producto del catálogo
`descuento_pct`, `precio_final` y `pauta` (la pauta vigente con mayor descuento). Solo avísame si encuentras algún
flujo que lea directamente `eco_productos.pauta_id`: esa columna ya no es la fuente de verdad.

## 3. Varias pautas por archivo de multimedia (no debería requerir cambios)

Un archivo de multimedia ahora puede estar en varias pautas (tabla `eco_multimedia_pautas`). `eco_contexto()` sigue
entregando en cada pauta su lista `imagenes` con la misma forma (lo verificamos: mismo JSON antes y después). Solo
avísame si algún flujo lee directamente `eco_multimedia.pauta_id`.

## Entregable 1: inventario y plan (sin cambiar nada)

1. Cada flujo y nodo donde hoy se decide si es horario hábil, qué agentes pueden recibir una conversación o qué aviso
   de "fuera de horario" se envía: nombre del flujo, nodo, y la lógica o SQL actual.
2. Dónde se usan `hubspot_agentes.hora_inicio` / `hora_fin`, los motivos `fuera_de_horario_*` y
   `estado_rotacion_agentes`.
3. Si algún flujo lee `eco_productos.pauta_id` o `eco_multimedia.pauta_id`.
4. El cambio propuesto, nodo por nodo, con las consultas nuevas.
5. Las preguntas que necesites que yo responda.

**Espera mi aprobación.**

## Entregable 2: implementación (después de mi aprobación)

- Copias `[DB]` inactivas con los cambios aprobados y los JSON de respaldo de los originales.
- Cómo probarlas sin afectar clientes reales. Casos mínimos (los preparo yo en la app de gestión):
  - un agente en horario recibe la conversación;
  - un agente con **descanso hoy** no la recibe, aunque su horario semanal diga que trabaja;
  - con **nadie** en horario en la bandeja, se envía el aviso de fuera de horario una sola vez;
  - un sábado o domingo, según lo que tenga cargado cada agente.
- Un resumen final de qué cambió en cada flujo y cómo volver atrás.
