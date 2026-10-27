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
      className="m-auto w-full max-w-lg rounded-lg border border-borde bg-panel p-0 text-texto shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-[1px]"
    >
      {abierto && (
        <>
          <div className="border-b border-borde px-5 py-3">
            <h2 className="text-sm font-medium">{titulo}</h2>
          </div>
          <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
        </>
      )}
    </dialog>
  );
}
