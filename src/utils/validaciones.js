const MAX_INT4 = 2147483647;

function parsearEnteroRango(valor, min = 1, max = MAX_INT4) {
  if (valor === null || valor === undefined || typeof valor === 'boolean' || typeof valor === 'object') {
    return null;
  }

  let numero;
  if (typeof valor === 'number') {
    numero = valor;
  } else if (typeof valor === 'string') {
    const limpio = valor.trim();
    if (!/^-?\d+$/.test(limpio)) return null;
    numero = Number(limpio);
  } else {
    return null;
  }

  if (!Number.isSafeInteger(numero) || numero < min || numero > max) {
    return null;
  }

  return numero;
}

function parsearIdEntero(valor) {
  return parsearEnteroRango(valor, 1, MAX_INT4);
}

function esFechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }

  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return fecha.getUTCFullYear() === anio
    && fecha.getUTCMonth() === mes - 1
    && fecha.getUTCDate() === dia;
}

module.exports = {
  MAX_INT4,
  parsearEnteroRango,
  parsearIdEntero,
  esFechaValida
};
