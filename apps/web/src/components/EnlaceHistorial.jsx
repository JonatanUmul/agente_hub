import { Link } from 'react-router-dom';

// Abre el historial filtrado por un registro. `registroId` es el id que usa la auditoría
// (id en casi todas las tablas, numero en preguntas, clave en configuración).
export function EnlaceHistorial({ tabla, registroId }) {
  const query = new URLSearchParams({ tabla, registroId: String(registroId) });
  return (
    <Link
      to={`/auditoria?${query}`}
      className="text-sm text-slate-600 underline-offset-2 hover:underline"
    >
      Historial
    </Link>
  );
}
