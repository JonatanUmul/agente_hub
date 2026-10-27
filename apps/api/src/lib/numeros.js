// pg devuelve numeric como string para no perder precisión ('1250.00').
// Nuestros montos tienen 2 decimales y caben de sobra en un Number.
export const aNumero = (valor) => (valor === null || valor === undefined ? null : Number(valor));
