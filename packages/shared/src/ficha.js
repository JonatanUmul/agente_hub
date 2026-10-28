// Reglas de la ficha de producto: qué campos aplican a cada tipo, qué le falta a un equipo,
// cómo la recibe el bot y qué características contradicen los propios campos del producto.

// Campos que solo tienen sentido en algunos tipos. Los demás aplican a todos.
export const TIPOS_POR_CAMPO = {
  capacidadPurificadorLitros: ['equipo', 'repuesto'],
  compatibleCon: ['repuesto', 'accesorio'],
};

export const ETIQUETAS_FICHA = {
  capacidadPurificadorLitros: 'Capacidad del purificador',
  compatibleCon: 'Compatible con',
};

export const campoAplica = (campo, tipo) =>
  !TIPOS_POR_CAMPO[campo] || TIPOS_POR_CAMPO[campo].includes(tipo);

const tieneValor = (v) => v !== null && v !== undefined && v !== '';

// Campos con valor que no corresponden al tipo del producto (el service los rechaza).
export const camposQueNoAplican = (tipo, datos) =>
  Object.keys(TIPOS_POR_CAMPO).filter((c) => tieneValor(datos[c]) && !campoAplica(c, tipo));

// ---------------------------------------------------------------- Textos que verá el cliente

// 37.5 → "37.5", 59 → "59" (sin ceros de relleno: así lo escribe el bot).
const numero = (n) => String(n);
const finito = (v) => (Number.isFinite(v) ? v : null);

// "ancho 37.5 cm × alto 59 cm": solo las medidas que existen; null si no hay ninguna.
export function textoMedidas({ anchoCm, altoCm, largoCm }) {
  const partes = [
    ['ancho', finito(anchoCm)],
    ['alto', finito(altoCm)],
    ['largo', finito(largoCm)],
  ]
    .filter(([, valor]) => valor !== null)
    .map(([nombre, valor]) => `${nombre} ${numero(valor)} cm`);
  return partes.length ? partes.join(' × ') : null;
}

export const textoPeso = (pesoLb) => (finito(pesoLb) === null ? null : `${numero(pesoLb)} lbs`);
const textoLitros = (litros) => (finito(litros) === null ? null : `${numero(litros)} L`);

// Ficha que recibe el bot cuando el cliente pregunta por el detalle, en el orden en que la recibe.
// Los campos vacíos no se envían (igual que eco_contexto()).
export function fichaQueVeElBot(p) {
  const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const lista = (v) => (Array.isArray(v) ? v.map(texto).filter(Boolean) : []);
  const filas = [
    ['Nombre', texto(p.nombre)],
    ['Descripción corta', texto(p.descripcionCorta)],
    ['Descripción', texto(p.descripcion)],
    ['Características', lista(p.caracteristicas)],
    ['Colores', lista(p.colores)],
    ['Material', texto(p.material)],
    ['Capacidad', texto(p.capacidadTexto)],
    ['Capacidad del purificador', textoLitros(p.capacidadPurificadorLitros)],
    ['Tasa de filtrado', texto(p.tasaFiltrado)],
    ['Compatible con', texto(p.compatibleCon)],
    ['Estado', texto(p.estado)],
    ['Medidas', textoMedidas(p)],
    ['Peso', textoPeso(p.pesoLb)],
  ];
  return filas
    .filter(([, valor]) => (Array.isArray(valor) ? valor.length > 0 : valor !== null))
    .map(([etiqueta, valor]) => ({ etiqueta, valor }));
}

// ---------------------------------------------------------------- Ficha completa (equipos)

// Lo que un equipo debería tener para que el bot responda el detalle sin inventar.
// Medidas completas = ancho y alto (los equipos redondos no tienen largo).
const REQUISITOS_EQUIPO = [
  ['descripción', (p) => tieneValor(p.descripcion)],
  ['material', (p) => tieneValor(p.material)],
  ['medidas', (p) => tieneValor(p.anchoCm) && tieneValor(p.altoCm)],
  ['peso', (p) => tieneValor(p.pesoLb)],
  ['purificador', (p) => tieneValor(p.capacidadPurificadorLitros)],
  ['tasa de filtrado', (p) => tieneValor(p.tasaFiltrado)],
];

// Lista de lo que falta; null si el producto no es un equipo (no se le exige ficha completa).
export function faltantesFicha(p) {
  if (p.tipo !== 'equipo') return null;
  return REQUISITOS_EQUIPO.filter(([, cumple]) => !cumple(p)).map(([nombre]) => nombre);
}

// ---------------------------------------------------------------- Posibles contradicciones

const normalizar = (t) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
const aNumero = (t) => Number(t.replace(',', '.'));
const iguales = (a, b) => Math.abs(a - b) < 0.01;

// Sobre texto ya normalizado (sin tildes, minúsculas).
const TASA =
  /\d+(?:[.,]\d+)?(?:\s*(?:-|–|a)\s*\d+(?:[.,]\d+)?)?\s*(?:l|lts?|litros?)\s*(?:por|\/|x|cada)\s*(?:h|horas?)\b/g;
const VOLUMEN = /(\d+(?:[.,]\d+)?)\s*(ml|mililitros?|l|lts?|litros?)\b/g;
const MEDIDA =
  /(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?\s*(?:cm|centimetros?)\b/g;
const PESO = /(\d+(?:[.,]\d+)?)\s*(?:lbs?|libras?)\b/g;
const PURIFICADOR = /purificador|unidad filtrante|elemento filtrante/;

const COLORES = [
  ['blanco', /\bblanc[oa]s?\b/],
  ['negro', /\bnegr[oa]s?\b/],
  ['rojo', /\broj[oa]s?\b/],
  ['azul', /\bazul(es)?\b/],
  ['verde', /\bverdes?\b/],
  ['gris', /\bgris(es)?\b/],
  ['celeste', /\bcelestes?\b/],
  ['rosado', /\b(rosad[oa]s?|rosas?)\b/],
  ['morado', /\bmorad[oa]s?\b/],
  ['amarillo', /\bamarill[oa]s?\b/],
  ['naranja', /\b(naranjas?|anaranjad[oa]s?)\b/],
  ['café', /\bcafes?\b/],
  ['beige', /\bbeige\b/],
  ['turquesa', /\bturquesas?\b/],
  ['plateado', /\bplatead[oa]s?\b/],
  ['dorado', /\bdorad[oa]s?\b/],
];
const coloresEn = (texto) =>
  COLORES.filter(([, patron]) => patron.test(normalizar(texto))).map(([nombre]) => nombre);

const litros = (valor, unidad) => (unidad.startsWith('m') ? valor / 1000 : valor);
function litrosDeTexto(texto) {
  if (!texto) return null;
  const [coincidencia] = normalizar(texto).matchAll(VOLUMEN);
  return coincidencia ? litros(aNumero(coincidencia[1]), coincidencia[2]) : null;
}

function revisarCapacidad(texto, p) {
  const purificador = finito(p.capacidadPurificadorLitros);
  const conocidas = [
    ['capacidad', litrosDeTexto(p.capacidadTexto), p.capacidadTexto],
    ['purificador', purificador, textoLitros(purificador)],
    ['capacidad en litros', finito(p.capacidadLitros), textoLitros(p.capacidadLitros)],
  ].filter(([, valor]) => valor !== null);
  if (!conocidas.length) return [];

  const limpio = texto.replace(TASA, ' ');
  // "Capacidad del purificador 10 L" se compara solo contra el purificador.
  const contra =
    PURIFICADOR.test(limpio) && purificador !== null
      ? conocidas.filter(([nombre]) => nombre === 'purificador')
      : conocidas;
  const descripcion = contra.map(([nombre, , como]) => `${nombre} ${como}`).join(', ');
  return [...limpio.matchAll(VOLUMEN)]
    .filter(([, n, unidad]) => !contra.some(([, v]) => iguales(v, litros(aNumero(n), unidad))))
    .map(([mencion]) => `Menciona «${mencion.trim()}»; el producto dice ${descripcion}`);
}

function revisarMedidas(texto, p) {
  const conocidas = [finito(p.anchoCm), finito(p.altoCm), finito(p.largoCm)].filter(
    (v) => v !== null,
  );
  if (!conocidas.length) return [];
  const mencionadas = [...texto.matchAll(MEDIDA)].flatMap(([, ...grupos]) =>
    grupos.filter(Boolean).map(aNumero),
  );
  const distintas = mencionadas.filter((n) => !conocidas.some((v) => iguales(v, n)));
  return distintas.length
    ? [`Menciona ${distintas.join(', ')} cm; las medidas son ${textoMedidas(p)}`]
    : [];
}

function revisarPeso(texto, p) {
  const peso = finito(p.pesoLb);
  if (peso === null) return [];
  return [...texto.matchAll(PESO)]
    .filter(([, n]) => !iguales(aNumero(n), peso))
    .map(([mencion]) => `Menciona «${mencion.trim()}»; el peso es ${textoPeso(peso)}`);
}

function revisarColores(texto, p) {
  const propios = new Set((p.colores ?? []).flatMap(coloresEn));
  if (!propios.size) return [];
  return coloresEn(texto)
    .filter((color) => !propios.has(color))
    .map((color) => `Menciona el color ${color}; los colores son ${p.colores.join(', ')}`);
}

// Características que mencionan un color, capacidad, medida o peso distinto al de los campos del
// producto. Es una advertencia: no impide guardar. Si el campo está vacío no hay con qué comparar.
export function contradiccionesFicha(p) {
  return (p.caracteristicas ?? []).flatMap((caracteristica, indice) => {
    if (typeof caracteristica !== 'string' || !caracteristica.trim()) return [];
    const texto = normalizar(caracteristica);
    return [
      ...revisarCapacidad(texto, p),
      ...revisarMedidas(texto, p),
      ...revisarPeso(texto, p),
      ...revisarColores(caracteristica, p),
    ].map((motivo) => ({ indice, caracteristica, motivo }));
  });
}
