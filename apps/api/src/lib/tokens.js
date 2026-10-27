import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// 32 bytes aleatorios = 256 bits: imposible de adivinar por fuerza bruta.
export const generarToken = () => randomBytes(32).toString('base64url');

// En la base solo guardamos el hash del token de sesión (ver migración de gestion.sesiones).
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Comparación en tiempo constante: evita deducir el token midiendo cuánto tarda la respuesta.
export function sonIguales(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}
