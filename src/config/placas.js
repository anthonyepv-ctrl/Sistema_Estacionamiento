const TIPO_VEHICULO = {
  auto: { nombre: 'Automóvil / Camioneta', regex: /^[A-Z][A-Z0-9]{2}-?\d{3}$/ },
  moto: { nombre: 'Motocicleta', regex: /^(\d{4}-?[A-Z0-9]{2}|[A-Z]{2}-?\d{4}|[A-Z]{3}-?\d{4})$/ }
};

function analizarPlaca(limpio) {
  if (limpio.length >= 7) {
    return { tipo: 'moto', corte: 3 };
  }

  if (/^\d/.test(limpio)) {
    return { tipo: 'moto', corte: 4 };
  }

  if (limpio.length === 6 && /\d{4}$/.test(limpio)) {
    return { tipo: 'moto', corte: 2 };
  }

  if (limpio.length === 6) {
    if (/^[A-Z][A-Z0-9]{2}\d{3}$/.test(limpio)) {
      return { tipo: 'auto', corte: 3 };
    }
    return { tipo: null, corte: 3 };
  }

  return { tipo: 'auto', corte: 3 };
}

const CARACTERES_PLACA_INVALIDOS = /[^A-Z0-9 -]/i;

function tieneCaracteresInvalidos(valor) {
  if (valor === undefined || valor === null) return false;
  return CARACTERES_PLACA_INVALIDOS.test(String(valor));
}

function normalizarPlaca(valor) {
  const limpio = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpio.length === 0) return '';

  const { corte } = analizarPlaca(limpio);
  if (limpio.length <= corte) return limpio;

  // No se recorta: una placa más larga que el formato se devuelve completa
  // para que la validación estricta la rechace.
  return `${limpio.slice(0, corte)}-${limpio.slice(corte)}`;
}

module.exports = {
  TIPO_VEHICULO,
  analizarPlaca,
  normalizarPlaca,
  tieneCaracteresInvalidos
};
