import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { InicioPage } from './InicioPage.jsx';
import { Layout } from './Layout.jsx';
import { RutaProtegida } from './RutaProtegida.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { AgentesPage } from '../features/agentes/AgentesPage.jsx';
import { AuditoriaPage } from '../features/auditoria/AuditoriaPage.jsx';
import { MiCuentaPage } from '../features/auth/MiCuentaPage.jsx';
import { FrasesPage } from '../features/frases/FrasesPage.jsx';
import { SaludosPage } from '../features/saludos/SaludosPage.jsx';
import { InterruptoresPage } from '../features/configuracion/InterruptoresPage.jsx';
import { ContextoPage } from '../features/contexto/ContextoPage.jsx';
import { MultimediaPage } from '../features/multimedia/MultimediaPage.jsx';
import { PautasPage } from '../features/pautas/PautasPage.jsx';
import { PreguntasPage } from '../features/preguntas/PreguntasPage.jsx';
import { ProductosPage } from '../features/productos/ProductosPage.jsx';
import { ReglasPage } from '../features/reglas/ReglasPage.jsx';
import { UsuariosPage } from '../features/usuarios/UsuariosPage.jsx';

// /reportes ahora es el inicio; se conserva para enlaces guardados (con sus filtros).
function AlInicio() {
  const { search } = useLocation();
  return <Navigate to={`/${search}`} replace />;
}

export function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="reportes" element={<AlInicio />} />
          <Route path="productos" element={<ProductosPage />} />
          <Route path="pautas" element={<PautasPage />} />
          <Route path="multimedia" element={<MultimediaPage />} />
          <Route path="interruptores" element={<InterruptoresPage />} />
          <Route path="reglas" element={<ReglasPage />} />
          <Route path="preguntas" element={<PreguntasPage />} />
          <Route path="frases-cierre" element={<FrasesPage />} />
          <Route path="saludos" element={<SaludosPage />} />
          <Route path="horarios" element={<AgentesPage />} />
          <Route path="que-ve-el-bot" element={<ContextoPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="mi-cuenta" element={<MiCuentaPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
