// Qué puede hacer cada rol. La API lo verifica en cada ruta; la web lo usa solo para mostrar u ocultar botones.
// Agregar un permiso aquí es la única forma de habilitar una acción nueva.
const TODOS = ['admin', 'comercial', 'contenido', 'lectura'];

export const PERMISOS = Object.freeze({
  ver: TODOS,
  'usuarios:gestionar': ['admin'],
  'productos:editar': ['admin', 'comercial'],
  'configuracion:editar': ['admin', 'comercial'],
  'pautas:editar': ['admin', 'comercial'],
  'multimedia:editar': ['admin', 'comercial'],
  'reglas:editar': ['admin', 'contenido'],
  'preguntas:editar': ['admin', 'contenido'],
  'horarios:editar': ['admin'],
  // El dashboard lo ven todos (permiso 'ver'); exportar a CSV, solo estos roles.
  'reportes:exportar': ['admin', 'comercial'],
});

export function tienePermiso(rol, permiso) {
  const roles = PERMISOS[permiso];
  if (!roles) throw new Error(`Permiso desconocido: ${permiso}`);
  return roles.includes(rol);
}
