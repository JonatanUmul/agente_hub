import { z } from 'zod';
import {
  esquemaCambiarActivo,
  esquemaCrearRegla,
  esquemaEditarRegla,
  esquemaRegla,
} from '@ecofiltro/shared';
import * as servicio from './reglas.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const editar = { permiso: 'reglas:editar' };

export async function rutasReglas(app) {
  app.get('/reglas', { schema: { response: { 200: z.array(esquemaRegla) } } }, () =>
    servicio.listarReglas(app.db),
  );

  app.get('/reglas/:id', { schema: { params, response: { 200: esquemaRegla } } }, (request) =>
    servicio.obtenerRegla(app.db, request.params.id),
  );

  app.post(
    '/reglas',
    { config: editar, schema: { body: esquemaCrearRegla, response: { 201: esquemaRegla } } },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.crearRegla(app.db, {
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  app.put(
    '/reglas/:id',
    {
      config: editar,
      schema: { params, body: esquemaEditarRegla, response: { 200: esquemaRegla } },
    },
    (request) =>
      servicio.editarRegla(app.db, {
        id: request.params.id,
        datos: request.body,
        correo: request.usuario.correo,
      }),
  );

  app.patch(
    '/reglas/:id/activo',
    {
      config: editar,
      schema: { params, body: esquemaCambiarActivo, response: { 200: esquemaRegla } },
    },
    (request) =>
      servicio.cambiarActivoRegla(app.db, {
        id: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      }),
  );
}
