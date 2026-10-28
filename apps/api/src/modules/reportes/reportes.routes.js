import { z } from 'zod';
import { TABLAS_EXPORTABLES, esquemaFiltrosReporte } from '@ecofiltro/shared';
import * as servicio from './reportes.service.js';

export async function rutasReportes(app) {
  // Todos los roles ven el dashboard (permiso por defecto 'ver').
  app.get('/reportes', { schema: { querystring: esquemaFiltrosReporte } }, (request) =>
    servicio.obtenerReporte(app.dbReportes, request.query),
  );

  app.get('/reportes/detalle', { schema: { querystring: esquemaFiltrosReporte } }, (request) =>
    servicio.obtenerDetalle(app.dbReportes, request.query),
  );

  // Exportar a CSV: solo admin y comercial.
  app.get(
    '/reportes/exportar/:tabla',
    {
      config: { permiso: 'reportes:exportar' },
      schema: {
        params: z.object({ tabla: z.enum(TABLAS_EXPORTABLES) }),
        querystring: esquemaFiltrosReporte,
      },
    },
    async (request, reply) => {
      const { tabla } = request.params;
      const { desde, hasta } = request.query;
      const csv = await servicio.exportarCsv(app.dbReportes, tabla, request.query);
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header(
          'Content-Disposition',
          `attachment; filename="ecofiltro-${tabla}-${desde}-a-${hasta}.csv"`,
        )
        .header('Cache-Control', 'no-store')
        .send(csv);
    },
  );
}
