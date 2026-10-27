import argon2 from 'argon2';

// Parámetros mínimos recomendados por OWASP para argon2id (19 MiB, 2 iteraciones, 1 hilo).
const OPCIONES = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const hashContrasena = (contrasena) => argon2.hash(contrasena, OPCIONES);

export async function verificarContrasena(hash, contrasena) {
  try {
    return await argon2.verify(hash, contrasena);
  } catch {
    // Un hash corrupto no debe tumbar el login: simplemente no coincide.
    return false;
  }
}

// Hash de una contraseña que nadie conoce. Se verifica contra él cuando el correo no existe,
// para que la respuesta tarde lo mismo y no revele qué correos están registrados.
let hashFicticio;
export async function verificarContraHashFicticio(contrasena) {
  hashFicticio ??= await hashContrasena(`ficticia-${Math.random()}`);
  await verificarContrasena(hashFicticio, contrasena);
  return false;
}
