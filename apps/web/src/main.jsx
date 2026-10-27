import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { Proveedores } from './app/Proveedores.jsx';
import { Rutas } from './app/Rutas.jsx';
import './index.css';

// Zod intenta usar new Function() para acelerar la validación; la política de seguridad (CSP) lo
// prohíbe y deja un error en consola. Con jitless valida igual, sin intentarlo.
z.config({ jitless: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Proveedores>
      <Rutas />
    </Proveedores>
  </StrictMode>,
);
