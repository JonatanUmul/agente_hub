# Módulo agentes

Horarios de atención de cada agente (docs/sql/002). El bot los consulta con `eco_agente_en_horario()` o la vista
`eco_v_agentes_en_horario` para saber a quién puede pasar una conversación.

- **Tablas:** `eco_agentes_horario` (rangos por día de la semana, ISO 1 = lunes), `eco_agentes_descanso`
  (fechas libres). Lee `hubspot_agentes` (solo id, nombre, apellido, email, bandeja, canal, estado, archivado; la
  sincroniza n8n y la app no la modifica).
- **Endpoints** (lectura: cualquier rol; escritura: permiso `horarios:editar` = admin):
  - `GET /api/agentes` → agentes no archivados con `horario` (7 días), `descansos` (de hoy en adelante),
    `enHorarioAhora` y `version`.
  - `PUT /api/agentes/:id/horario` `{ dias: [7 × { diaSemana, rangos: [{ horaInicio, horaFin }] }], version }` → 204.
    Reemplaza la semana completa. Día sin rangos = descansa. 409 si otra persona guardó antes.
  - `POST /api/agentes/:id/descansos` `{ desde, hasta, motivo }` → 201.
  - `DELETE /api/agentes/:id/descansos/:descansoId` → 204.
- **Reglas:**
  - Hora de Guatemala. El fin de cada rango es exclusivo; `24:00` = hasta medianoche (en la app se escribe 23:59).
  - Rangos del mismo día sin cruzarse; varios rangos = turno partido.
  - Una fecha de descanso gana sobre el horario semanal.
  - `hubspot_agentes.hora_inicio/hora_fin` quedan como estaban: la app ya no los usa.
