import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { AppError } from '../lib/app-error.js';

// Todas las respuestas de error tienen la misma forma: { error: { codigo, mensaje, detalles? } }.
// Así el cliente web maneja errores en un solo lugar.
function responder(reply, estadoHttp, codigo, mensaje, detalles) {
  const error = { codigo, mensaje };
  if (detalles !== undefined) error.detalles = detalles;
  return reply.code(estadoHttp).send({ error });
}

async function errores(app) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return responder(reply, error.estadoHttp, error.codigo, error.message, error.detalles);
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const detalles = error.validation.map((v) => ({
        campo: v.instancePath.replace(/^\//, '').replaceAll('/', '.'),
        mensaje: v.message,
      }));
      return responder(reply, 400, 'VALIDACION', 'Los datos enviados no son válidos', detalles);
    }

    // La respuesta no cumple su esquema: es un bug nuestro, no del cliente.
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, issues: error.cause?.issues }, 'Respuesta fuera de esquema');
      return responder(reply, 500, 'ERROR_INTERNO', 'Ocurrió un error inesperado');
    }

    // Errores propios de Fastify con estado 4xx (JSON mal formado, cuerpo muy grande, rate limit...).
    if (error.statusCode && error.statusCode < 500) {
      return responder(reply, error.statusCode, error.code ?? 'SOLICITUD_INVALIDA', error.message);
    }

    request.log.error({ err: error }, 'Error no controlado');
    return responder(reply, 500, 'ERROR_INTERNO', 'Ocurrió un error inesperado');
  });

  app.setNotFoundHandler((request, reply) =>
    responder(reply, 404, 'RUTA_NO_ENCONTRADA', `No existe ${request.method} ${request.url}`),
  );
}

export default fp(errores, { name: 'errores' });
