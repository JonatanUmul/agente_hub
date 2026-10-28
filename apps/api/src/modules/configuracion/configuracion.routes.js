import { z } from 'zod';
import {
  INTERRUPTORES_COMERCIALES,
  esquemaCambiarInterruptor,
  esquemaInterruptor,
} from '@ecofiltro/shared';
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
        // cierre_automatico se cambia en /frases-cierre/cierre-automatico (otro permiso).
        params: z.object({ clave: z.enum(INTERRUPTORES_COMERCIALES) }),
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
