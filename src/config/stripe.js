const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function obtenerLlaveSecreta() {
  return process.env.STRIPE_SECRET_KEY ? String(process.env.STRIPE_SECRET_KEY).trim() : '';
}

function obtenerLlavePublica() {
  return process.env.STRIPE_PUBLISHABLE_KEY ? String(process.env.STRIPE_PUBLISHABLE_KEY).trim() : '';
}

function stripeConfigurado() {
  return Boolean(obtenerLlaveSecreta() && obtenerLlavePublica());
}

async function llamarStripe(ruta, params) {
  const secretKey = obtenerLlaveSecreta();
  if (!secretKey) {
    const err = new Error('La pasarela de pagos (Stripe) aún no está configurada en el servidor.');
    err.statusCode = 503;
    throw err;
  }

  const body = new URLSearchParams(params);
  const res = await fetch(`${STRIPE_API_BASE}${ruta}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || 'Error al procesar el pago en Stripe.';
    const err = new Error(msg);
    err.statusCode = res.status >= 400 && res.status < 500 ? 402 : 502;
    throw err;
  }

  return data;
}

async function obtenerPaymentIntent(paymentIntentId) {
  const secretKey = obtenerLlaveSecreta();
  if (!secretKey) {
    const err = new Error('La pasarela de pagos (Stripe) aún no está configurada en el servidor.');
    err.statusCode = 503;
    throw err;
  }

  const res = await fetch(`${STRIPE_API_BASE}/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` }
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || 'No se pudo verificar el pago en Stripe.';
    const err = new Error(msg);
    err.statusCode = 402;
    throw err;
  }

  return data;
}

/**
 * Crea un PaymentIntent en moneda PEN (céntimos) para el adelanto de reserva.
 */
async function crearPaymentIntentReserva({ montoSoles, codigoReserva, idUsuario, placa }) {
  const amount = Math.round(Number(montoSoles) * 100);
  return llamarStripe('/payment_intents', {
    amount: String(amount),
    currency: 'pen',
    'automatic_payment_methods[enabled]': 'true',
    'automatic_payment_methods[allow_redirects]': 'never',
    description: `Adelanto reserva cochera (${placa})`,
    'metadata[id_usuario]': String(idUsuario),
    'metadata[placa]': String(placa),
    'metadata[codigo_tmp]': String(codigoReserva || '')
  });
}

/**
 * Reembolsa un PaymentIntent al anular la reserva (UPAO-22).
 */
async function reembolsarPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return null;
  return llamarStripe('/refunds', {
    payment_intent: String(paymentIntentId)
  });
}

module.exports = {
  stripeConfigurado,
  obtenerLlavePublica,
  crearPaymentIntentReserva,
  obtenerPaymentIntent,
  reembolsarPaymentIntent
};
