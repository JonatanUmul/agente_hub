import { z } from 'zod';
import {
  esquemaCambiarActivo,
  esquemaCrearSaludo,
  esquemaEditarSaludo,
  esquemaEliminarSaludo,
  esquemaFiltrosSaludos,
  esquemaGuardarTextoMenu,
  esquemaModuloSaludo,
  esquemaSaludo,
  esquemaSaludoGuardado,
  esquemaSaludoVigente,
  esquemaSimulacionSaludo,
  esquemaSimularSaludo,
  esquemaTextoMenu,
} from '@ecofiltro/shared';
import * as servicio from './saludos.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const editar = { permiso: 'saludos:editar' };

export async function rutasSaludos(app) {
  app.get(
    '/saludos',
    { schema: { querystring: esquemaFiltrosSaludos, response: { 200: z.array(esquemaSaludo) } } },
    (request) => servicio.listarSaludos(app.db, request.query),
  );

  app.get(
    '/saludos/vigente',
    { schema: { querystring: esquemaModuloSaludo, response: { 200: esquemaSaludoVigente } } },
    (request) => servicio.saludoVigente(app.db, request.query.modulo),
  );

  app.get(
    '/saludos/simular',
    { schema: { querystring: esquemaSimularSaludo, response: { 200: esquemaSimulacionSaludo } } },
    (request) => servicio.simularSaludo(app.db, request.query),
  );

  app.get('/saludos/menu-bienvenida', { schema: { response: { 200: esquemaTextoMenu } } }, () =>
    servicio.leerTextoMenu(app.db),
  );

  app.put(
    '/saludos/menu-bienvenida',
    {
      config: editar,
      schema: { body: esquemaGuardarTextoMenu, response: { 200: esquemaTextoMenu } },
    },
    (request) =>
      servicio.guardarTextoMenu(app.db, { ...request.body, correo: request.usuario.correo }),
  );

  app.post(
    '/saludos',
    {
      config: editar,
      schema: { body: esquemaCrearSaludo, response: { 201: esquemaSaludoGuardado } },
    },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.crearSaludo(app.db, {
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  app.put(
    '/saludos/:id',
    {
      config: editar,
      schema: { params, body: esquemaEditarSaludo, response: { 200: esquemaSaludoGuardado } },
    },
    (request) =>
      servicio.editarSaludo(app.db, {
        id: request.params.id,
        datos: request.body,
        correo: request.usuario.correo,
      }),
  );

  app.patch(
    '/saludos/:id/activo',
    {
      config: editar,
      schema: { params, body: esquemaCambiarActivo, response: { 200: esquemaSaludo } },
    },
    (request) =>
      servicio.cambiarActivoSaludo(app.db, {
        id: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      }),
  );

  app.delete(
    '/saludos/:id',
    { config: editar, schema: { params, querystring: esquemaEliminarSaludo } },
    async (request, reply) => {
      await servicio.eliminarSaludo(app.db, {
        id: request.params.id,
        version: request.query.version,
        correo: request.usuario.correo,
      });
      return reply.code(204).send();
    },
  );
}
