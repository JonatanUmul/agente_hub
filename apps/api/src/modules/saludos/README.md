# Módulo saludos

Saludo del primer mensaje del bot (`eco_saludos`), por módulo y temporada. El bot lo obtiene con `eco_saludo(modulo)`.

- **Tablas:** `eco_saludos` (lectura, alta, edición y borrado); función `eco_saludo(text)`. El texto del menú inicial es el mensaje `menu_bienvenida` (módulo mensajes).
- **Endpoints** (leer: cualquier rol; escribir: permiso `saludos:editar` = admin, contenido):
  - `GET /api/saludos?modulo=&activo=&vigentesHoy=` — cada saludo trae `vigenteHoy`.
  - `POST /api/saludos` → 201, `PUT /api/saludos/:id` (con `version`). Responden el saludo y `choques`: los activos
    del mismo módulo y prioridad que coinciden en algún día (el bot elegiría al azar). No bloquean.
  - `PATCH /api/saludos/:id/activo`, `DELETE /api/saludos/:id?version=…` → 204.
  - `GET /api/saludos/vigente?modulo=` — `SELECT eco_saludo($1)`.
  - `GET /api/saludos/simular?modulo=&fecha=YYYY-MM-DD&hora=HH:MM` — misma lógica que la función
    (`candidatosSaludo` en `@ecofiltro/shared/saludos.js`); con empate devuelve todos los candidatos.
- **Reglas:** módulo de los CHECK; saludo de 3 a 300 caracteres, sin Markdown, único comodín `{momento}`; fechas
  ambas o ninguna; sin repetir cada año, fin ≥ inicio. Nombre repetido en el módulo → 409 `NOMBRE_EN_USO`.
