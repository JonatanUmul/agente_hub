import { Suspense, lazy } from 'react';
import { EstadoSistema } from '../features/salud/EstadoSistema.jsx';

// Reportes trae la librería de gráficos (recharts): se descarga aparte del resto de la app.
const ReportesPage = lazy(() =>
  import('../features/reportes/ReportesPage.jsx').then((m) => ({ default: m.ReportesPage })),
);

// Inicio = estado del sistema + dashboard de reportes del bot.
export function InicioPage() {
  return (
    <div className="space-y-4">
      <EstadoSistema />
      <Suspense fallback={<p className="text-tenue">Cargando reportes…</p>}>
        <ReportesPage />
      </Suspense>
    </div>
  );
}
