import {
  CAMPOS_FICHA,
  CAMPOS_VISION,
  ETIQUETAS_FICHA,
  TIPOS_POR_CAMPO,
  calcularPrecioFinal,
  camposQueNoAplican,
  itemCode,
  mencionaCodigo,
} from '@ecofiltro/shared';
import { withTransaction } from '../../db/transaction.js';
import {
  AppError,
  esViolacionLlaveForanea,
  esViolacionUnica,
  noEncontrado,
} from '../../lib/app-error.js';
import { editarConVersion } from '../../lib/edicion.js';
import * as repo from './productos.repository.js';

const CAMPOS_EDITABLES = [
  'codigo',
  'variante',
  'nombreCorto',
  'precioBase',
  'descuentoPct',
  'estado',
  'colores',
  'palabrasClave',
  'pautaIds',
  'orden',
  'activo',
  ...CAMPOS_FICHA,
  ...CAMPOS_VISION,
];

// Purificador solo en equipos y repuestos; compatibilidad solo en repuestos y accesorios.
// Se valida aquí porque el tipo del producto está en la base, no en el formulario.
function validarCamposPorTipo(tipo, datos) {
  const sobrantes = camposQueNoAplican(tipo, datos);
  if (sobrantes.length === 0) return;
  throw new AppError({
    codigo: 'CAMPO_NO_APLICA',
    mensaje: sobrantes
      .map((c) => `«${ETIQUETAS_FICHA[c]}» solo aplica a: ${TIPOS_POR_CAMPO[c].join(', ')}`)
      .join('. '),
    estadoHttp: 400,
    detalles: sobrantes.map((campo) => ({ campo, tipo })),
  });
}

// Precio final con el descuento que aplica hoy (la misma cuenta que hace eco_contexto()).
// Para productos inactivos es null: el bot no los ofrece.
const conPrecioFinal = (producto) => ({
  ...producto,
  precioFinal:
    producto.descuentoVigentePct === null
      ? null
      : calcularPrecioFinal(producto.precioBase, producto.descuentoVigentePct),
});

export async function listarProductos(db) {
  return (await repo.listar(db)).map(conPrecioFinal);
}

export async function obtenerProducto(db, id) {
  const producto = await repo.obtenerPorId(db, id);
  if (!producto) throw noEncontrado('Producto no encontrado');
  return conPrecioFinal(producto);
}

const codigoDuplicado = (codigo, otro) =>
  new AppError({
    codigo: 'CODIGO_DUPLICADO',
    mensaje: otro
      ? `El ItemCode ${codigo} ya lo usa «${otro.nombre}» (ItemCode ${otro.codigo}${otro.activo ? '' : ', inactivo'})`
      : `El ItemCode ${codigo} ya lo usa otro producto`,
    estadoHttp: 409,
    detalles: otro ? [{ id: otro.id, codigo: otro.codigo, nombre: otro.nombre }] : undefined,
  });

async function verificarCodigoLibre(db, codigo, excluirId) {
  const otro = await repo.buscarCodigoEnUso(db, codigo, excluirId);
  if (otro) throw codigoDuplicado(codigo, otro);
}

// Errores de la base que la persona puede corregir. La UNIQUE del código atrapa a dos personas
// guardando el mismo código a la vez (la verificación previa no lo ve).
function traducirError(error, codigo) {
  if (esViolacionLlaveForanea(error)) {
    return new AppError({
      codigo: 'PAUTA_INEXISTENTE',
      mensaje: 'Alguna de las pautas seleccionadas no existe',
      estadoHttp: 400,
    });
  }
  if (esViolacionUnica(error)) return codigoDuplicado(codigo, null);
  return error;
}

async function editar(db, opciones, codigo) {
  try {
    const producto = await editarConVersion(db, {
      ...opciones,
      repo,
      campos: CAMPOS_EDITABLES,
      mensajeNoEncontrado: 'Producto no encontrado',
    });
    return conPrecioFinal(producto);
  } catch (error) {
    throw traducirError(error, codigo);
  }
}

// Cambiar el ItemCode no rompe fotos ni pautas (apuntan por producto_id), pero sí los textos que lo
// escriben. Por eso la web muestra antes el impacto y aquí se exige esa confirmación.
// Devuelve el código a guardar (el nuevo, normalizado).
async function verificarCambioCodigo(client, id, actual, datos) {
  if (datos.codigo === actual.codigo) return actual.codigo;
  const nuevo = itemCode.safeParse(datos.codigo);
  if (!nuevo.success) {
    throw new AppError({
      codigo: 'ITEMCODE_NO_VALIDO',
      mensaje: `ItemCode: ${nuevo.error.issues[0].message}`,
      estadoHttp: 400,
    });
  }
  if (nuevo.data === actual.codigo) return actual.codigo;
  if (!datos.confirmarCambioCodigo) {
    throw new AppError({
      codigo: 'CONFIRMAR_CAMBIO_CODIGO',
      mensaje: 'Confirma el cambio de ItemCode después de revisar a qué afecta',
      estadoHttp: 400,
    });
  }
  await verificarCodigoLibre(client, nuevo.data, id);
  return nuevo.data;
}

// Reemplaza los campos editables. `version` debe coincidir con la que el usuario vio al abrir el producto.
export const editarProducto = (db, { id, datos, correo }) =>
  editar(
    db,
    {
      id,
      version: datos.version,
      correo,
      aplicar: async (actual, client) => {
        validarCamposPorTipo(actual.tipo, datos);
        const codigo = await verificarCambioCodigo(client, id, actual, datos);
        return { ...datos, codigo };
      },
    },
    datos.codigo,
  );

// Activar / desactivar desde la tabla, sin abrir el formulario completo.
export const cambiarActivo = (db, { id, activo, version, correo }) =>
  editar(db, { id, version, correo, aplicar: (actual) => ({ ...actual, activo }) });

export async function crearProducto(db, { datos, correo }) {
  validarCamposPorTipo(datos.tipo, datos);
  try {
    const producto = await withTransaction(db, async (client) => {
      await verificarCodigoLibre(client, datos.codigo, null);
      const id = await repo.crear(client, datos, correo);
      await repo.guardarPautas(client, id, datos.pautaIds, correo);
      return repo.obtenerPorId(client, id);
    });
    return conPrecioFinal(producto);
  } catch (error) {
    throw traducirError(error, datos.codigo);
  }
}

// Qué pasaría al cambiar el ItemCode del producto `id` a `codigo` (solo lectura).
export async function impactoCambioCodigo(db, { id, codigo }) {
  const producto = await repo.obtenerPorId(db, id);
  if (!producto) throw noEncontrado('Producto no encontrado');
  const [conflicto, dependencias, textos] = await Promise.all([
    repo.buscarCodigoEnUso(db, codigo, id),
    repo.contarDependencias(db, id),
    repo.buscarTextosConCodigo(db, producto.codigo),
  ]);
  return {
    conflicto,
    dependencias,
    menciones: textos
      .filter((t) => mencionaCodigo(t.texto, producto.codigo))
      .map(({ tabla, id: filaId, etiqueta, activo }) => ({ tabla, id: filaId, etiqueta, activo })),
  };
}
