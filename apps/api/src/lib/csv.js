// CSV para Excel en español: separador ";" (Excel de configuración regional española/latina lo espera),
// BOM UTF-8 para que respete las tildes, y comillas cuando hace falta.
//
// Inyección de fórmulas: una celda que empieza con = + - @ (o tab / retorno) se ejecutaría como fórmula al
// abrir el archivo. Se antepone un apóstrofo para que Excel la trate como texto.
const PELIGROSO = /^[=+\-@\t\r]/;
// Marca de orden de bytes: le indica a Excel que el archivo es UTF-8.
const BOM = String.fromCharCode(0xfeff);

function celda(valor) {
  if (valor === null || valor === undefined) return '';
  let texto = Array.isArray(valor) ? valor.join(', ') : String(valor);
  if (PELIGROSO.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

// columnas: [{ titulo, valor: (fila) => … }]
export function aCsv(columnas, filas) {
  const lineas = [columnas.map((c) => celda(c.titulo)).join(';')];
  for (const fila of filas) lineas.push(columnas.map((c) => celda(c.valor(fila))).join(';'));
  return `${BOM}${lineas.join('\r\n')}\r\n`;
}
