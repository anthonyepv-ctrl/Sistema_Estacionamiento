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

function normalizarPlaca(valor) {
  const limpio = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpio.length === 0) return '';

  const { corte } = analizarPlaca(limpio);
  if (limpio.length <= corte) return limpio;

  const maxLen = limpio.length >= 7 ? 7 : 6;
  return `${limpio.slice(0, corte)}-${limpio.slice(corte, maxLen)}`;
}

/**
 * Valida formato peruano SUNARP/MTC y coherencia Poka-Yoke con el tipo ('auto' | 'moto').
 * @returns {{ ok: true, placa: string, config: { nombre: string, regex: RegExp } } | { ok: false, error: string }}
 */
function validarPlacaYTipo(placaRaw, tipo) {
  const config = typeof tipo === 'string' && Object.prototype.hasOwnProperty.call(TIPO_VEHICULO, tipo)
    ? TIPO_VEHICULO[tipo]
    : null;
  if (!config) {
    return { ok: false, error: 'Seleccione un tipo de vehículo válido (auto o moto).' };
  }

  if (typeof placaRaw !== 'string') {
    return { ok: false, error: 'Ingrese la placa del vehículo.' };
  }

  const alfanumerico = placaRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!alfanumerico) {
    return { ok: false, error: 'Ingrese la placa del vehículo.' };
  }

  if (alfanumerico.length < 6 || alfanumerico.length > 7) {
    return { ok: false, error: 'Ingrese una placa válida según el formato peruano (ej. ABC-123 o 1234-5A).' };
  }

  const placa = normalizarPlaca(alfanumerico);

  const analisis = analizarPlaca(alfanumerico);
  if (analisis.tipo && analisis.tipo !== tipo) {
    const esperado = analisis.tipo === 'auto' ? 'Automóvil / Camioneta' : 'Motocicleta';
    const seleccionado = tipo === 'auto' ? 'Automóvil / Camioneta' : 'Motocicleta';
    return {
      ok: false,
      error: `Incoherencia de vehículo: la placa ${placa} corresponde a ${esperado} según la norma oficial MTC, no puede registrarse como ${seleccionado}.`
    };
  }

  if (!config.regex.test(placa)) {
    return { ok: false, error: 'Ingrese una placa válida según el formato peruano (ej. ABC-123 o 1234-5A).' };
  }

  if (/-0{3,4}$/.test(placa) || /^0{4}-/.test(placa)) {
    return { ok: false, error: 'La numeración 000/0000 no es válida en placas SUNARP/MTC.' };
  }

  return { ok: true, placa, config };
}

module.exports = {
  TIPO_VEHICULO,
  analizarPlaca,
  normalizarPlaca,
  validarPlacaYTipo
};
