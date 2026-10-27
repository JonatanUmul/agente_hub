import { z } from 'zod';

// Piezas de validación que usan varios módulos.

export const fechaIso = z.iso.datetime({ offset: true });

// Recorta, quita vacíos y repetidos. No cambia mayúsculas (el bot puede depender de ellas).
export const listaDeTextos = z
  .array(z.string().trim().max(100))
  .max(100)
  .transform((lista) => [...new Set(lista.filter(Boolean))]);

// numeric(p,2) guarda 2 decimales; más se redondearía en silencio.
// La tolerancia absorbe errores de punto flotante (0.1 * 100 = 10.000000000000002).
export const conDosDecimales = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

export const porcentaje = z
  .number('Debe ser un número')
  .min(0, 'Mínimo 0')
  .max(100, 'Máximo 100')
  .refine(conDosDecimales, 'Máximo 2 decimales');

export const textoRequerido = (max) => z.string().trim().min(1, 'Requerido').max(max);
export const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((t) => (t ? t : null));

export const orden = z
  .number('Debe ser un número')
  .int('Debe ser entero')
  .min(-1_000_000)
  .max(1_000_000);

// `version` = actualizado_en de la fila; detecta si otra persona guardó mientras editabas.
export const version = z.string().min(1);
