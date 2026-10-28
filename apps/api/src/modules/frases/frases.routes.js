import { z } from 'zod';
import {
  esquemaCambiarActivo,
  esquemaCambiarInterruptor,
  esquemaCrearFrase,
  esquemaEditarFrase,
  esquemaEliminarFrase,
  esquemaFiltrosFrases,
  esquemaFrase,
  esquemaInterruptor,
  esquemaReordenarFrases,
} from '@ecofiltro/shared';
import * as servicio from './frases.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const editar = { permiso: 'frases:editar' };

export async function rutasFrases(app) {
  app.get(
    '/frases-cierre',
    { schema: { querystring: esquemaFiltrosFrases, response: { 200: z.array(esquemaFrase) } } },
    (request) => servicio.listarFrases(app.db, request.query),
  );

  app.post(
    '/frases-cierre',
    { config: editar, schema: { body: esquemaCrearFrase, response: { 201: esquemaFrase } } },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.crearFrase(app.db, {
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  // Ruta fija antes que /:id (Fastify da prioridad a las rutas estáticas de todas formas).
  app.put(
    '/frases-cierre/orden',
    {
      config: editar,
      schema: { body: esquemaReordenarFrases, response: { 200: z.array(esquemaFrase) } },
    },
    (request) =>
      servicio.reordenarFrases(app.db, { lista: request.body, correo: request.usuario.correo }),
  );

  app.put(
    '/frases-cierre/cierre-automatico',
    {
      config: editar,
      schema: { body: esquemaCambiarInterruptor, response: { 200: esquemaInterruptor } },
    },
    (request) =>
      servicio.cambiarCierreAutomatico(app.db, {
        habilitado: request.body.habilitado,
        correo: request.usuario.correo,
      }),
  );

  app.put(
    '/frases-cierre/:id',
    {
      config: editar,
      schema: { params, body: esquemaEditarFrase, response: { 200: esquemaFrase } },
    },
    (request) =>
      servicio.editarFrase(app.db, {
        id: request.params.id,
        datos: request.body,
        correo: request.usuario.correo,
      }),
  );

  app.patch(
    '/frases-cierre/:id/activo',
    {
      config: editar,
      schema: { params, body: esquemaCambiarActivo, response: { 200: esquemaFrase } },
    },
    (request) =>
      servicio.cambiarActivoFrase(app.db, {
        id: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      }),
  );

  // La versión va en la query (?version=…): algunos proxies descartan el cuerpo de un DELETE.
  app.delete(
    '/frases-cierre/:id',
    { config: editar, schema: { params, querystring: esquemaEliminarFrase } },
    async (request, reply) => {
      await servicio.eliminarFrase(app.db, {
        id: request.params.id,
        version: request.query.version,
        correo: request.usuario.correo,
      });
      return reply.code(204).send();
    },
  );
}
