import { z } from 'zod';
import { INTERRUPTORES, esquemaCambiarInterruptor, esquemaInterruptor } from '@ecofiltro/shared';
import * as servicio from './configuracion.service.js';

export async function rutasConfiguracion(app) {
  app.get(
    '/configuracion/interruptores',
    { schema: { response: { 200: z.array(esquemaInterruptor) } } },
    () => servicio.listarInterruptores(app.db),
  );

  app.put(
    '/configuracion/interruptores/:clave',
    {
      config: { permiso: 'configuracion:editar' },
      schema: {
        params: z.object({ clave: z.enum(INTERRUPTORES) }),
        body: esquemaCambiarInterruptor,
        response: { 200: esquemaInterruptor },
      },
    },
    (request) =>
      servicio.cambiarInterruptor(app.db, {
        clave: request.params.clave,
        habilitado: request.body.habilitado,
        correo: request.usuario.correo,
      }),
  );
}
