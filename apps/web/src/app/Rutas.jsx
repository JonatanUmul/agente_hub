import { Route, Routes } from 'react-router-dom';
import { Layout } from './Layout.jsx';
import { RutaProtegida } from './RutaProtegida.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { AuditoriaPage } from '../features/auditoria/AuditoriaPage.jsx';
import { MiCuentaPage } from '../features/auth/MiCuentaPage.jsx';
import { InterruptoresPage } from '../features/configuracion/InterruptoresPage.jsx';
import { ContextoPage } from '../features/contexto/ContextoPage.jsx';
import { MultimediaPage } from '../features/multimedia/MultimediaPage.jsx';
import { PautasPage } from '../features/pautas/PautasPage.jsx';
import { PreguntasPage } from '../features/preguntas/PreguntasPage.jsx';
import { ProductosPage } from '../features/productos/ProductosPage.jsx';
import { ReglasPage } from '../features/reglas/ReglasPage.jsx';
import { SaludPage } from '../features/salud/SaludPage.jsx';
import { UsuariosPage } from '../features/usuarios/UsuariosPage.jsx';

export function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<SaludPage />} />
          <Route path="productos" element={<ProductosPage />} />
          <Route path="pautas" element={<PautasPage />} />
          <Route path="multimedia" element={<MultimediaPage />} />
          <Route path="interruptores" element={<InterruptoresPage />} />
          <Route path="reglas" element={<ReglasPage />} />
          <Route path="preguntas" element={<PreguntasPage />} />
          <Route path="que-ve-el-bot" element={<ContextoPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="mi-cuenta" element={<MiCuentaPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
