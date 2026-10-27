import { esquemaSalud } from '@ecofiltro/shared';
import { obtenerSalud } from './salud.service.js';

export async function rutasSalud(app) {
  app.get(
    '/salud',
    { config: { publica: true }, schema: { response: { 200: esquemaSalud, 503: esquemaSalud } } },
    async (request, reply) => {
      const salud = await obtenerSalud(app.db);
      // 503 permite que Docker / el proxy detecten que la API no puede trabajar.
      return reply.code(salud.estado === 'ok' ? 200 : 503).send(salud);
    },
  );
}
