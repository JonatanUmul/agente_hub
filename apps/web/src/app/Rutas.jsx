import { Route, Routes } from 'react-router-dom';
import { Layout } from './Layout.jsx';
import { RutaProtegida } from './RutaProtegida.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { MiCuentaPage } from '../features/auth/MiCuentaPage.jsx';
import { InterruptoresPage } from '../features/configuracion/InterruptoresPage.jsx';
import { MultimediaPage } from '../features/multimedia/MultimediaPage.jsx';
import { PautasPage } from '../features/pautas/PautasPage.jsx';
import { ProductosPage } from '../features/productos/ProductosPage.jsx';
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
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="mi-cuenta" element={<MiCuentaPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
