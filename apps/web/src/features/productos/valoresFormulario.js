import { CAMPOS_FICHA } from '@ecofiltro/shared';

// Valores iniciales del formulario de producto: editar, duplicar o crear desde cero.
// En el formulario las listas se escriben separadas por comas y las características son filas [{ texto }].

const NUMEROS_FICHA = ['capacidadPurificadorLitros', 'anchoCm', 'altoCm', 'largoCm', 'pesoLb'];
const fichaDe = (p) =>
  Object.fromEntries(
    CAMPOS_FICHA.map((campo) => {
      if (campo === 'caracteristicas')
        return [campo, (p?.caracteristicas ?? []).map((texto) => ({ texto }))];
      if (NUMEROS_FICHA.includes(campo)) return [campo, p?.[campo] ?? null];
      return [campo, p?.[campo] ?? ''];
    }),
  );

export const valoresParaEditar = (p) => ({
  codigo: p.codigo,
  variante: p.variante ?? '',
  nombreCorto: p.nombreCorto ?? '',
  precioBase: p.precioBase,
  descuentoPct: p.descuentoPct,
  estado: p.estado,
  colores: p.colores.join(', '),
  palabrasClave: p.palabrasClave.join(', '),
  pautaIds: p.pautas.map((pa) => pa.id).sort((a, b) => a - b),
  orden: p.orden,
  activo: p.activo,
  ...fichaDe(p),
  pistasVisuales: p.pistasVisuales ?? '',
  fotosReferencia: p.fotosReferencia.map((f) => ({ url: f.url, color: f.color ?? '' })),
});

// Producto nuevo. Nace inactivo: el bot no lo ofrece hasta que la persona lo active.
export const valoresParaCrear = () => ({
  codigo: '',
  nombre: '',
  tipo: 'equipo',
  familia: '',
  capacidadLitros: null,
  variante: '',
  nombreCorto: '',
  precioBase: null,
  descuentoPct: 0,
  estado: 'disponible',
  colores: '',
  palabrasClave: '',
  pautaIds: [],
  orden: 100,
  activo: false,
  ...fichaDe(null),
  pistasVisuales: '',
  fotosReferencia: [],
});

// Copia la ficha de otro producto (otra variante de la misma familia). No copia el código, las pautas,
// los colores ni las fotos: son de cada variante.
export const valoresParaDuplicar = (p) => ({
  ...valoresParaCrear(),
  nombre: `${p.nombre} (copia)`,
  tipo: p.tipo,
  familia: p.familia,
  capacidadLitros: p.capacidadLitros,
  variante: p.variante ?? '',
  nombreCorto: p.nombreCorto ?? '',
  precioBase: p.precioBase,
  descuentoPct: p.descuentoPct,
  estado: p.estado,
  palabrasClave: p.palabrasClave.join(', '),
  orden: p.orden,
  ...fichaDe(p),
  pistasVisuales: p.pistasVisuales ?? '',
});
