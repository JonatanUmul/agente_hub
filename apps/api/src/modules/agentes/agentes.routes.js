import { z } from 'zod';
import {
  esquemaAgente,
  esquemaCrearDescanso,
  esquemaDescanso,
  esquemaGuardarHorario,
} from '@ecofiltro/shared';
import * as servicio from './agentes.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const paramsDescanso = params.extend({ descansoId: z.coerce.number().int().positive() });
const editar = { permiso: 'horarios:editar' };

export async function rutasAgentes(app) {
  app.get('/agentes', { schema: { response: { 200: z.array(esquemaAgente) } } }, () =>
    servicio.listarAgentes(app.db),
  );

  app.put(
    '/agentes/:id/horario',
    { config: editar, schema: { params, body: esquemaGuardarHorario } },
    async (request, reply) => {
      await servicio.guardarHorario(app.db, {
        agenteId: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      });
      return reply.code(204).send();
    },
  );

  app.post(
    '/agentes/:id/descansos',
    {
      config: editar,
      schema: { params, body: esquemaCrearDescanso, response: { 201: esquemaDescanso } },
    },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.agregarDescanso(app.db, {
          agenteId: request.params.id,
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  app.delete(
    '/agentes/:id/descansos/:descansoId',
    { config: editar, schema: { params: paramsDescanso } },
    async (request, reply) => {
      await servicio.quitarDescanso(app.db, {
        agenteId: request.params.id,
        descansoId: request.params.descansoId,
      });
      return reply.code(204).send();
    },
  );
}
