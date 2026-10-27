// Error de negocio con todo lo que el manejador central necesita para responder.
// `mensaje` es lo que verá la persona usuaria, así que debe ser claro y sin detalles internos.
export class AppError extends Error {
  constructor({ codigo, mensaje, estadoHttp = 400, detalles }) {
    super(mensaje);
    this.name = 'AppError';
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}

export const noEncontrado = (mensaje = 'Recurso no encontrado') =>
  new AppError({ codigo: 'NO_ENCONTRADO', mensaje, estadoHttp: 404 });

// Código de PostgreSQL para violación de UNIQUE.
export const esViolacionUnica = (error) => error?.code === '23505';

// Código de PostgreSQL para violación de llave foránea.
export const esViolacionLlaveForanea = (error) => error?.code === '23503';

// Otra persona guardó el registro después de que lo abriste (control de concurrencia optimista).
export const conflictoDeVersion = () =>
  new AppError({
    codigo: 'CONFLICTO_VERSION',
    mensaje:
      'Otra persona modificó este registro mientras lo editabas. Recarga y vuelve a intentarlo.',
    estadoHttp: 409,
  });

// Código de PostgreSQL para violación de CHECK.
export const esViolacionCheck = (error) => error?.code === '23514';
