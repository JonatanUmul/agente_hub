import { esquemaFiltrosAuditoria, esquemaPaginaAuditoria } from '@ecofiltro/shared';
import * as servicio from './auditoria.service.js';

export async function rutasAuditoria(app) {
  app.get(
    '/auditoria',
    { schema: { querystring: esquemaFiltrosAuditoria, response: { 200: esquemaPaginaAuditoria } } },
    (request) => servicio.buscarHistorial(app.db, request.query),
  );
}
