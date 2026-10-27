import { z } from 'zod';
import {
  esquemaCambiarActivo,
  esquemaCrearPauta,
  esquemaEditarPauta,
  esquemaPauta,
  esquemaPautaResumen,
} from '@ecofiltro/shared';
import * as servicio from './pautas.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const editar = { permiso: 'pautas:editar' };

export async function rutasPautas(app) {
  app.get('/pautas', { schema: { response: { 200: z.array(esquemaPauta) } } }, () =>
    servicio.listarPautas(app.db),
  );

  // Liviano, para selectores en productos y multimedia.
  app.get('/pautas/resumen', { schema: { response: { 200: z.array(esquemaPautaResumen) } } }, () =>
    servicio.listarPautasResumen(app.db),
  );

  app.get('/pautas/:id', { schema: { params, response: { 200: esquemaPauta } } }, (request) =>
    servicio.obtenerPauta(app.db, request.params.id),
  );

  app.post(
    '/pautas',
    { config: editar, schema: { body: esquemaCrearPauta, response: { 201: esquemaPauta } } },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.crearPauta(app.db, {
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  app.put(
    '/pautas/:id',
    {
      config: editar,
      schema: { params, body: esquemaEditarPauta, response: { 200: esquemaPauta } },
    },
    (request) =>
      servicio.editarPauta(app.db, {
        id: request.params.id,
        datos: request.body,
        correo: request.usuario.correo,
      }),
  );

  app.patch(
    '/pautas/:id/activo',
    {
      config: editar,
      schema: { params, body: esquemaCambiarActivo, response: { 200: esquemaPauta } },
    },
    (request) =>
      servicio.cambiarActivoPauta(app.db, {
        id: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      }),
  );
}
