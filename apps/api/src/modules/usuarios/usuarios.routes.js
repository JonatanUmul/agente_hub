import { z } from 'zod';
import {
  esquemaCrearUsuario,
  esquemaEditarUsuario,
  esquemaRestablecerContrasena,
  esquemaUsuario,
} from '@ecofiltro/shared';
import * as servicio from './usuarios.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const soloAdmin = { permiso: 'usuarios:gestionar' };

export async function rutasUsuarios(app) {
  app.get(
    '/usuarios',
    { config: soloAdmin, schema: { response: { 200: z.array(esquemaUsuario) } } },
    () => servicio.listarUsuarios(app.db),
  );

  app.post(
    '/usuarios',
    { config: soloAdmin, schema: { body: esquemaCrearUsuario, response: { 201: esquemaUsuario } } },
    async (request, reply) =>
      reply.code(201).send(await servicio.crearUsuario(app.db, request.body)),
  );

  app.patch(
    '/usuarios/:id',
    {
      config: soloAdmin,
      schema: { params, body: esquemaEditarUsuario, response: { 200: esquemaUsuario } },
    },
    (request) =>
      servicio.editarUsuario(app.db, {
        id: request.params.id,
        cambios: request.body,
        actorId: request.usuario.id,
      }),
  );

  app.post(
    '/usuarios/:id/contrasena',
    { config: soloAdmin, schema: { params, body: esquemaRestablecerContrasena } },
    async (request, reply) => {
      await servicio.restablecerContrasena(app.db, {
        id: request.params.id,
        contrasena: request.body.contrasena,
      });
      return reply.code(204).send();
    },
  );
}
