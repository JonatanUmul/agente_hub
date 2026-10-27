import { esquemaContexto, esquemaModuloContexto } from '@ecofiltro/shared';
import * as servicio from './contexto.service.js';

export async function rutasContexto(app) {
  app.get(
    '/contexto/:modulo',
    { schema: { params: esquemaModuloContexto, response: { 200: esquemaContexto } } },
    (request) => servicio.obtenerContexto(app.db, request.params.modulo),
  );
}
