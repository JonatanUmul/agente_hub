import { useEffect, useRef } from 'react';

// Usa <dialog> nativo: el navegador se encarga del foco, la tecla Escape y el fondo.
export function Modal({ abierto, titulo, alCerrar, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      className="m-auto w-full max-w-md rounded-lg p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      {abierto && (
        <div className="p-5">
          <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
