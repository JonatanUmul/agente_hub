// Único punto por el que la web habla con la API.
// Convierte la forma de error de la API ({ error: { codigo, mensaje } }) en un ApiError.
export class ApiError extends Error {
  constructor({ estadoHttp, codigo, mensaje, detalles }) {
    super(mensaje);
    this.name = 'ApiError';
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

// El token CSRF vive solo en memoria: lo entrega la API al iniciar sesión o al consultar /auth/sesion.
let csrfToken = null;
export const guardarCsrfToken = (token) => {
  csrfToken = token;
};

// Lo registra la app para reaccionar cuando la sesión vence a mitad del uso.
let alNoAutenticado = () => {};
export const configurarAlNoAutenticado = (fn) => {
  alNoAutenticado = fn;
};

const METODOS_SEGUROS = new Set(['GET', 'HEAD']);

export async function api(
  ruta,
  { method = 'GET', body, aceptarEstados = [], avisar401 = true } = {},
) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!METODOS_SEGUROS.has(method) && csrfToken) headers['x-csrf-token'] = csrfToken;

  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method,
      credentials: 'same-origin',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({
      estadoHttp: 0,
      codigo: 'ERROR_RED',
      mensaje: 'No se pudo contactar al servidor',
    });
  }

  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);

  // Algunas rutas (como /salud con 503) devuelven datos útiles aunque el estado no sea 2xx.
  if (respuesta.ok || aceptarEstados.includes(respuesta.status)) return datos;

  if (respuesta.status === 401 && avisar401) alNoAutenticado();
  throw new ApiError({
    estadoHttp: respuesta.status,
    codigo: datos?.error?.codigo ?? 'ERROR_DESCONOCIDO',
    mensaje: datos?.error?.mensaje ?? 'Ocurrió un error inesperado',
    detalles: datos?.error?.detalles,
  });
}
