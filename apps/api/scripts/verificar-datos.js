// Verifica, en SOLO LECTURA, que la app puede mostrar y guardar los datos que hay en la base.
// Pasa cada registro por los mismos esquemas Zod que usan la API y los formularios.
// Uso: npm run verificar-datos   (en el servidor: docker compose ... run --rm api node scripts/verificar-datos.js)
import pg from 'pg';
import {
  CAMPOS_FICHA,
  MODULOS,
  esquemaArchivo,
  esquemaContexto,
  esquemaEditarArchivo,
  esquemaEditarFrase,
  esquemaFrase,
  esquemaEditarPregunta,
  esquemaEditarProducto,
  esquemaEditarRegla,
  esquemaInterruptor,
  esquemaPauta,
  esquemaPregunta,
  esquemaProducto,
  esquemaRegla,
} from '@ecofiltro/shared';
import { cargarEnv } from '../src/config/env.js';
import { listarInterruptores } from '../src/modules/configuracion/configuracion.service.js';
import * as frases from '../src/modules/frases/frases.repository.js';
import * as multimedia from '../src/modules/multimedia/multimedia.repository.js';
import * as pautas from '../src/modules/pautas/pautas.repository.js';
import * as preguntas from '../src/modules/preguntas/preguntas.repository.js';
import { listarProductos } from '../src/modules/productos/productos.service.js';
import * as reglas from '../src/modules/reglas/reglas.repository.js';

const config = cargarEnv();
// Toda transacción de esta conexión es de solo lectura: el script no puede modificar nada.
const pool = new pg.Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
  options: '-c default_transaction_read_only=on',
  max: 2,
});

const problemas = [];
function validar(nombre, esquema, filas, id) {
  for (const fila of filas) {
    const r = esquema.safeParse(fila);
    if (!r.success) {
      const detalle = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      problemas.push(`${nombre} ${id(fila)} → ${detalle}`);
    }
  }
  console.log(`✓ ${nombre}: ${filas.length} registro(s)`);
}
const tomar = (fila, campos) => Object.fromEntries(campos.map((c) => [c, fila[c]]));

try {
  const productos = await listarProductos(pool);
  validar('productos', esquemaProducto, productos, (p) => p.codigo);
  validar(
    'productos (guardar sin cambios)',
    esquemaEditarProducto,
    productos.map((p) => ({
      ...tomar(p, [
        'precioBase',
        'descuentoPct',
        'estado',
        'colores',
        'palabrasClave',
        'orden',
        'activo',
        ...CAMPOS_FICHA,
        'version',
      ]),
      pautaIds: p.pautas.map((pa) => pa.id),
      codigo: p.codigo,
    })),
    (p) => p.codigo,
  );

  validar('pautas', esquemaPauta, await pautas.listar(pool), (p) => p.codigo);

  const archivos = await multimedia.listar(pool);
  validar('multimedia', esquemaArchivo, archivos, (a) => a.hubspotFileId);
  validar(
    'multimedia (guardar sin cambios)',
    esquemaEditarArchivo,
    archivos.map((a) => ({
      ...tomar(a, ['descripcion', 'color', 'tema', 'orden', 'activo', 'version', 'hubspotFileId']),
      productoId: a.producto?.id ?? null,
      pautaIds: a.pautas.map((pa) => pa.id),
    })),
    (a) => a.hubspotFileId,
  );

  const listaReglas = await reglas.listar(pool);
  validar('reglas', esquemaRegla, listaReglas, (r) => r.codigo);
  validar('reglas (guardar sin cambios)', esquemaEditarRegla, listaReglas, (r) => r.codigo);

  const listaPreguntas = await preguntas.listar(pool);
  validar('preguntas', esquemaPregunta, listaPreguntas, (q) => `#${q.numero}`);
  validar(
    'preguntas (guardar sin cambios)',
    esquemaEditarPregunta,
    listaPreguntas,
    (q) => `#${q.numero}`,
  );

  const listaFrases = await frases.listar(pool);
  validar('frases de cierre', esquemaFrase, listaFrases, (f) => `#${f.id}`);
  validar(
    'frases de cierre (guardar sin cambios)',
    esquemaEditarFrase,
    listaFrases,
    (f) => `#${f.id}`,
  );

  validar('interruptores', esquemaInterruptor, await listarInterruptores(pool), (i) => i.clave);

  for (const modulo of MODULOS) {
    const { rows } = await pool.query('SELECT eco_contexto($1) AS c', [modulo]);
    validar(`contexto ${modulo}`, esquemaContexto, [rows[0].c], () => modulo);
  }
} finally {
  await pool.end();
}

if (problemas.length) {
  console.error(`\n✗ ${problemas.length} problema(s):\n${problemas.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('\nTodo en orden: la app puede mostrar y guardar los datos actuales.');
}
