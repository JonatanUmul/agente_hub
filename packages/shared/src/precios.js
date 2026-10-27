// Cálculo del precio igual al de eco_contexto() en la base:
//   round(precio_base * (1 - descuento / 100), 2)
// Se hace con enteros (centavos y centésimas de %) para no arrastrar errores de punto flotante;
// PostgreSQL redondea la mitad hacia arriba en positivos, igual que este cálculo.
const aCentavos = (monto) => Math.round(monto * 100);
const aCentesimasDePct = (pct) => Math.round(pct * 100);

export function calcularPrecioFinal(precioBase, descuentoPct) {
  if (precioBase === null || precioBase === undefined) return null;
  const producto = aCentavos(precioBase) * (10_000 - aCentesimasDePct(descuentoPct ?? 0));
  return Math.floor((producto + 5_000) / 10_000) / 100;
}

// Descuento que aplicará hoy, con la misma regla que la vista eco_v_catalogo:
//   sin pauta → el del producto; pauta vigente → el mayor de los dos; pauta inactiva o vencida → 0.
// Solo para la vista previa del formulario: la API siempre devuelve el valor real de la vista.
export function descuentoVigente({ descuentoPct, pauta }) {
  if (!pauta) return descuentoPct;
  if (!pauta.vigente) return 0;
  return Math.max(descuentoPct, pauta.descuentoPct ?? 0);
}

// Lo que el bot le dirá al cliente sobre el precio de un producto, según los interruptores.
// Refleja las reglas de eco_contexto(): sin precios no hay precio; sin promociones no hay descuento.
export function precioQueVeElBot({ producto, preciosHabilitados, promocionesHabilitadas }) {
  if (!producto.activo) return { visible: false, motivo: 'Producto inactivo: el bot no lo conoce' };
  if (!preciosHabilitados) return { visible: false, motivo: 'Precios deshabilitados' };
  if (producto.precioBase === null) return { visible: false, motivo: 'Sin precio base' };

  const descuento = promocionesHabilitadas ? producto.descuentoVigentePct : 0;
  return {
    visible: true,
    precio: calcularPrecioFinal(producto.precioBase, descuento),
    descuentoPct: descuento > 0 ? descuento : null,
  };
}
