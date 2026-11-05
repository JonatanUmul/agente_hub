import { esArte } from '@ecofiltro/shared';

// Recuadro del archivo: la app no tiene acceso a las imágenes de HubSpot, así que muestra descripción e ID.
export function Miniatura({ archivo, chica = false }) {
  return (
    <div
      className={`flex shrink-0 flex-col justify-between rounded-md border border-borde-fuerte bg-panel-2 p-1.5 text-[10px] ${chica ? 'h-14 w-14' : 'h-24 w-24'}`}
    >
      <span className={`text-texto ${chica ? 'line-clamp-2' : 'line-clamp-3'}`}>
        {archivo.descripcion}
      </span>
      <span className="truncate font-mono text-apagado">#{archivo.hubspotFileId}</span>
    </div>
  );
}

// «Arte» (imagen sin producto) o «Foto de producto»; los videos no llevan etiqueta.
export function ChipArte({ archivo }) {
  if (archivo.tipo === 'video') return null;
  const arte = esArte(archivo);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] ${arte ? 'bg-acento/15 text-acento' : 'bg-panel-2 text-tenue'}`}
    >
      {arte ? 'Arte de la pauta' : 'Foto de producto'}
    </span>
  );
}
