import { z } from 'zod';
import {
  esquemaCambiarActivo,
  esquemaCrearPregunta,
  esquemaEditarPregunta,
  esquemaPregunta,
} from '@ecofiltro/shared';
import * as servicio from './preguntas.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const editar = { permiso: 'preguntas:editar' };

export async function rutasPreguntas(app) {
  app.get('/preguntas', { schema: { response: { 200: z.array(esquemaPregunta) } } }, () =>
    servicio.listarPreguntas(app.db),
  );

  app.get(
    '/preguntas/siguiente-numero',
    { schema: { response: { 200: z.object({ numero: z.number().int() }) } } },
    async () => ({ numero: await servicio.siguienteNumero(app.db) }),
  );

  app.get('/preguntas/:id', { schema: { params, response: { 200: esquemaPregunta } } }, (request) =>
    servicio.obtenerPregunta(app.db, request.params.id),
  );

  app.post(
    '/preguntas',
    { config: editar, schema: { body: esquemaCrearPregunta, response: { 201: esquemaPregunta } } },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.crearPregunta(app.db, {
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  app.put(
    '/preguntas/:id',
    {
      config: editar,
      schema: { params, body: esquemaEditarPregunta, response: { 200: esquemaPregunta } },
    },
    (request) =>
      servicio.editarPregunta(app.db, {
        id: request.params.id,
        datos: request.body,
        correo: request.usuario.correo,
      }),
  );

  app.patch(
    '/preguntas/:id/activo',
    {
      config: editar,
      schema: { params, body: esquemaCambiarActivo, response: { 200: esquemaPregunta } },
    },
    (request) =>
      servicio.cambiarActivoPregunta(app.db, {
        id: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      }),
  );
}
