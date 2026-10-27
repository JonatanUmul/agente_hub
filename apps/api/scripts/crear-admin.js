// Crea un usuario admin desde la consola. La contraseña se escribe sin mostrarse y nunca
// se acepta como argumento (quedaría en el historial del shell).
// Uso: npm run crear-admin
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { esquemaCrearUsuario } from '@ecofiltro/shared';
import { cargarEnv } from '../src/config/env.js';
import { crearPool } from '../src/db/pool.js';
import { crearUsuario } from '../src/modules/usuarios/usuarios.service.js';

// readline repite en pantalla lo que se teclea; lo mandamos a una salida que podemos silenciar.
let silenciar = false;
const eco = new Writable({
  write(fragmento, codificacion, listo) {
    if (!silenciar) process.stdout.write(fragmento, codificacion);
    listo();
  },
});
const consola = createInterface({
  input: process.stdin,
  output: eco,
  terminal: process.stdin.isTTY,
});
const lineas = consola[Symbol.asyncIterator]();

async function preguntar(texto, { oculto = false } = {}) {
  process.stdout.write(texto);
  silenciar = oculto;
  const { value } = await lineas.next();
  silenciar = false;
  if (oculto) process.stdout.write('\n');
  return value ?? '';
}

const pool = crearPool(cargarEnv());
try {
  const correo = await preguntar('Correo: ');
  const nombre = await preguntar('Nombre: ');
  const contrasena = await preguntar('Contraseña (mínimo 12 caracteres): ', { oculto: true });
  if ((await preguntar('Repite la contraseña: ', { oculto: true })) !== contrasena) {
    throw new Error('Las contraseñas no coinciden');
  }

  const datos = esquemaCrearUsuario.safeParse({ correo, nombre, rol: 'admin', contrasena });
  if (!datos.success) {
    throw new Error(datos.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
  }

  const usuario = await crearUsuario(pool, datos.data);
  console.log(`Admin creado: ${usuario.correo} (id ${usuario.id})`);
} catch (error) {
  console.error(`No se creó el admin: ${error.message}`);
  process.exitCode = 1;
} finally {
  consola.close();
  await pool.end();
}
