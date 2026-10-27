import { z } from 'zod';
import { esquemaPautaResumen } from '@ecofiltro/shared';
import * as servicio from './pautas.service.js';

export async function rutasPautas(app) {
  app.get('/pautas/resumen', { schema: { response: { 200: z.array(esquemaPautaResumen) } } }, () =>
    servicio.listarPautasResumen(app.db),
  );
}
