// Globo de mensaje recibido, con los colores de WhatsApp.
export function GloboWhatsapp({ children }) {
  return (
    <div className="max-w-sm rounded-lg rounded-tl-none bg-[#d9fdd3] px-3 py-2 text-sm whitespace-pre-wrap text-[#111b21] shadow-sm">
      {children}
    </div>
  );
}
