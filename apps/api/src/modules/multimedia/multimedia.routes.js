import { z } from 'zod';
import {
  esquemaArchivo,
  esquemaCambiarActivo,
  esquemaCrearArchivo,
  esquemaEditarArchivo,
} from '@ecofiltro/shared';
import * as servicio from './multimedia.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const editar = { permiso: 'multimedia:editar' };

export async function rutasMultimedia(app) {
  app.get('/multimedia', { schema: { response: { 200: z.array(esquemaArchivo) } } }, () =>
    servicio.listarArchivos(app.db),
  );

  app.get('/multimedia/:id', { schema: { params, response: { 200: esquemaArchivo } } }, (request) =>
    servicio.obtenerArchivo(app.db, request.params.id),
  );

  app.post(
    '/multimedia',
    { config: editar, schema: { body: esquemaCrearArchivo, response: { 201: esquemaArchivo } } },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.crearArchivo(app.db, {
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  app.put(
    '/multimedia/:id',
    {
      config: editar,
      schema: { params, body: esquemaEditarArchivo, response: { 200: esquemaArchivo } },
    },
    (request) =>
      servicio.editarArchivo(app.db, {
        id: request.params.id,
        datos: request.body,
        correo: request.usuario.correo,
      }),
  );

  app.patch(
    '/multimedia/:id/activo',
    {
      config: editar,
      schema: { params, body: esquemaCambiarActivo, response: { 200: esquemaArchivo } },
    },
    (request) =>
      servicio.cambiarActivoArchivo(app.db, {
        id: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      }),
  );
}
