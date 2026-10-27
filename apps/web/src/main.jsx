import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Proveedores } from './app/Proveedores.jsx';
import { Rutas } from './app/Rutas.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Proveedores>
      <Rutas />
    </Proveedores>
  </StrictMode>,
);
