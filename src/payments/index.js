const culqi = require('./culqi');
const {
  obtenerProveedorActivo,
  obtenerCredencialesActivas,
  obtenerEstadoPasarela,
  guardarCredencialesPasarela,
  restaurarCredencialesServidor,
  limpiarCacheCredenciales
} = require('./configStore');

const MONTO_MINIMO_RESERVA_SOLES = 3.00;

function obtenerMinimoYapeSoles() {
  const valor = Number(process.env.CULQI_YAPE_MINIMO_SOLES || 6.00);
  return Number.isFinite(valor) && valor > 0 ? valor : 6.00;
}

function calcularMontoAdelanto(precioHora) {
  const base = Number(precioHora || 0);
  return Number(Math.max(base, MONTO_MINIMO_RESERVA_SOLES).toFixed(2));
}

const ADAPTADORES = {
  culqi
};

function obtenerAdaptador(proveedor) {
  const adaptador = typeof proveedor === 'string' && Object.prototype.hasOwnProperty.call(ADAPTADORES, proveedor)
    ? ADAPTADORES[proveedor]
    : null;
  if (!adaptador) {
    const err = new Error(`Proveedor de pasarela no soportado: ${proveedor}`);
    err.statusCode = 500;
    throw err;
  }
  return adaptador;
}

async function cobrarReserva({ montoSoles, sourceToken, email, idempotencyKey, metadata }) {
  const creds = await obtenerCredencialesActivas();
  if (!creds.habilitado || !creds.secretKey) {
    const err = new Error('La pasarela de pagos (Culqi) aún no está configurada en el servidor.');
    err.statusCode = 503;
    throw err;
  }

  const adaptador = obtenerAdaptador(creds.proveedor);
  return adaptador.cobrar({
    secretKey: creds.secretKey,
    montoSoles,
    sourceToken,
    email,
    idempotencyKey,
    metadata
  });
}

async function reembolsarCargo({ chargeId, montoSoles, reason = 'solicitud_comprador', idempotencyKey }) {
  const creds = await obtenerCredencialesActivas();
  if (!creds.habilitado || !creds.secretKey) {
    const err = new Error('La pasarela de pagos (Culqi) aún no está configurada en el servidor.');
    err.statusCode = 503;
    throw err;
  }

  const adaptador = obtenerAdaptador(creds.proveedor);
  return adaptador.reembolsar({
    secretKey: creds.secretKey,
    chargeId,
    montoSoles,
    reason,
    idempotencyKey
  });
}

module.exports = {
  MONTO_MINIMO_RESERVA_SOLES,
  obtenerMinimoYapeSoles,
  calcularMontoAdelanto,
  obtenerProveedorActivo,
  obtenerEstadoPasarela,
  guardarCredencialesPasarela,
  restaurarCredencialesServidor,
  limpiarCacheCredenciales,
  cobrarReserva,
  reembolsarCargo
};
