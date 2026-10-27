// Uso: npm run migrar            (aplica todas las pendientes)
//      npm run migrar -- down    (revierte la última)
import { cargarEnv } from '../src/config/env.js';
import { migrar } from '../src/db/migrar.js';

const direccion = process.argv[2] ?? 'up';
if (!['up', 'down'].includes(direccion)) {
  console.error('Dirección inválida: usa "up" o "down"');
  process.exit(1);
}

const aplicadas = await migrar(cargarEnv(), { direccion, log: (m) => console.log(m) });
console.log(
  aplicadas.length ? `Listo: ${aplicadas.map((m) => m.name).join(', ')}` : 'Nada pendiente.',
);
