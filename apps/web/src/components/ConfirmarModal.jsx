import { Boton } from './Boton.jsx';
import { MensajeError } from './MensajeError.jsx';
import { Modal } from './Modal.jsx';

// Para cambios sensibles: el bot los aplica en el siguiente mensaje del cliente.
export function ConfirmarModal({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  peligro = false,
  cargando = false,
  error,
  alConfirmar,
  alCancelar,
}) {
  return (
    <Modal abierto={abierto} titulo={titulo} alCerrar={alCancelar}>
      <div className="space-y-4">
        <div className="text-sm text-slate-700">{mensaje}</div>
        <MensajeError error={error} />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={alCancelar}>
            Cancelar
          </Boton>
          <Boton
            variante={peligro ? 'peligro' : 'primario'}
            cargando={cargando}
            onClick={alConfirmar}
          >
            {textoConfirmar}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
