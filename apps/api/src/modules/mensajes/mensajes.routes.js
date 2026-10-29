import { z } from 'zod';
import {
  esquemaActivoMensaje,
  esquemaCrearMensaje,
  esquemaEditarMensaje,
  esquemaEliminarMensaje,
  esquemaReordenarMensajes,
  esquemaTipoMensaje,
  esquemaVersionMensaje,
} from '@ecofiltro/shared';
import * as servicio from './mensajes.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const editar = { permiso: 'mensajes:editar' };

export async function rutasMensajes(app) {
  app.get('/mensajes', { schema: { response: { 200: z.array(esquemaTipoMensaje) } } }, () =>
    servicio.listarMensajes(app.db),
  );

  app.post(
    '/mensajes',
    {
      config: editar,
      schema: { body: esquemaCrearMensaje, response: { 201: esquemaVersionMensaje } },
    },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.crearMensaje(app.db, {
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  app.put(
    '/mensajes/orden',
    {
      config: editar,
      schema: { body: esquemaReordenarMensajes, response: { 200: z.array(esquemaVersionMensaje) } },
    },
    (request) =>
      servicio.reordenarMensajes(app.db, { lista: request.body, correo: request.usuario.correo }),
  );

  app.put(
    '/mensajes/:id',
    {
      config: editar,
      schema: { params, body: esquemaEditarMensaje, response: { 200: esquemaVersionMensaje } },
    },
    (request) =>
      servicio.editarMensaje(app.db, {
        id: request.params.id,
        datos: request.body,
        correo: request.usuario.correo,
      }),
  );

  app.patch(
    '/mensajes/:id/activo',
    {
      config: editar,
      schema: { params, body: esquemaActivoMensaje, response: { 200: esquemaVersionMensaje } },
    },
    (request) =>
      servicio.cambiarActivoMensaje(app.db, {
        id: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      }),
  );

  app.delete(
    '/mensajes/:id',
    { config: editar, schema: { params, querystring: esquemaEliminarMensaje } },
    async (request, reply) => {
      await servicio.eliminarMensaje(app.db, {
        id: request.params.id,
        ...request.query,
        correo: request.usuario.correo,
      });
      return reply.code(204).send();
    },
  );
}
