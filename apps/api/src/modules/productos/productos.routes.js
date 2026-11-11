import { z } from 'zod';
import {
  esquemaCambiarActivo,
  esquemaCrearProducto,
  esquemaEditarProducto,
  esquemaImpactoCodigo,
  esquemaProducto,
  itemCode,
} from '@ecofiltro/shared';
import * as servicio from './productos.service.js';

const params = z.object({ id: z.coerce.number().int().positive() });
const editar = { permiso: 'productos:editar' };

export async function rutasProductos(app) {
  app.get('/productos', { schema: { response: { 200: z.array(esquemaProducto) } } }, () =>
    servicio.listarProductos(app.db),
  );

  app.get('/productos/:id', { schema: { params, response: { 200: esquemaProducto } } }, (request) =>
    servicio.obtenerProducto(app.db, request.params.id),
  );

  app.post(
    '/productos',
    { config: editar, schema: { body: esquemaCrearProducto, response: { 201: esquemaProducto } } },
    async (request, reply) =>
      reply.code(201).send(
        await servicio.crearProducto(app.db, {
          datos: request.body,
          correo: request.usuario.correo,
        }),
      ),
  );

  // Paso previo a cambiar el ItemCode: con quién choca, qué cuelga del producto y qué textos lo escriben.
  app.get(
    '/productos/:id/impacto-codigo',
    {
      config: editar,
      schema: {
        params,
        querystring: z.object({ codigo: itemCode }),
        response: { 200: esquemaImpactoCodigo },
      },
    },
    (request) =>
      servicio.impactoCambioCodigo(app.db, {
        id: request.params.id,
        codigo: request.query.codigo,
      }),
  );

  app.put(
    '/productos/:id',
    {
      config: editar,
      schema: { params, body: esquemaEditarProducto, response: { 200: esquemaProducto } },
    },
    (request) =>
      servicio.editarProducto(app.db, {
        id: request.params.id,
        datos: request.body,
        correo: request.usuario.correo,
      }),
  );

  app.patch(
    '/productos/:id/activo',
    {
      config: editar,
      schema: { params, body: esquemaCambiarActivo, response: { 200: esquemaProducto } },
    },
    (request) =>
      servicio.cambiarActivo(app.db, {
        id: request.params.id,
        ...request.body,
        correo: request.usuario.correo,
      }),
  );
}
