import { esquemaControlAccesos, esquemaFiltrosAccesos } from '@ecofiltro/shared';
import * as servicio from './accesos.service.js';

export async function rutasAccesos(app) {
  app.get(
    '/accesos',
    {
      config: { permiso: 'usuarios:gestionar' },
      schema: { querystring: esquemaFiltrosAccesos, response: { 200: esquemaControlAccesos } },
    },
    (request) => servicio.obtenerControl(app.db, request.query),
  );
}
