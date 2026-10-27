import { useEffect, useState } from 'react';

// Devuelve `valor` solo cuando deja de cambiar durante `ms`. Evita una consulta por cada tecla.
// Compara por JSON para aceptar objetos (como un conjunto de filtros) recreados en cada render.
export function useDiferido(valor, ms = 400) {
  const [diferido, setDiferido] = useState(valor);
  const clave = JSON.stringify(valor);
  useEffect(() => {
    const espera = setTimeout(() => setDiferido(JSON.parse(clave)), ms);
    return () => clearTimeout(espera);
  }, [clave, ms]);
  return diferido;
}
