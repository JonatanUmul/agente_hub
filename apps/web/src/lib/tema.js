import { useState } from 'react';

// Modo claro/oscuro. public/tema.js ya lo aplicó al cargar; aquí solo se cambia y se recuerda.
const leer = () => (document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro');

export function useTema() {
  const [tema, setTema] = useState(leer);

  const alternar = () => {
    const nuevo = tema === 'oscuro' ? 'claro' : 'oscuro';
    document.documentElement.dataset.tema = nuevo;
    try {
      localStorage.setItem('tema', nuevo);
    } catch {
      // Sin almacenamiento (navegación privada): el modo vale solo para esta visita.
    }
    setTema(nuevo);
  };

  return { tema, alternar };
}
