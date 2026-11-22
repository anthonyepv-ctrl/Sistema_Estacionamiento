const fs = require('fs');
const path = require('path');

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const CONFIG_KEYS_PATH = path.join(__dirname, 'stripe-keys.json');
const REGEX_PK = /^pk_(test|live)_[A-Za-z0-9_]{10,}$/;
const REGEX_SK = /^(sk|rk)_(test|live)_[A-Za-z0-9_]{10,}$/;

let overrideCredenciales = null;

function leerCredencialesGuardadas() {
  if (overrideCredenciales && overrideCredenciales.publishableKey && overrideCredenciales.secretKey) {
    return overrideCredenciales;
  }
  try {
    if (fs.existsSync(CONFIG_KEYS_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_KEYS_PATH, 'utf8'));
      const pk = data && data.publishableKey ? String(data.publishableKey).trim() : '';
      const sk = data && data.secretKey ? String(data.secretKey).trim() : '';
      if (pk && sk) {
        overrideCredenciales = { publishableKey: pk, secretKey: sk };
        return overrideCredenciales;
      }
    }
  } catch (error) {
    console.error('Error al leer credenciales guardadas de Stripe:', error);
  }
  return null;
}

function obtenerLlaveSecreta() {
  const guardadas = leerCredencialesGuardadas();
  if (guardadas) return guardadas.secretKey;
  return process.env.STRIPE_SECRET_KEY ? String(process.env.STRIPE_SECRET_KEY).trim() : '';
}

function obtenerLlavePublica() {
  const guardadas = leerCredencialesGuardadas();
  if (guardadas) return guardadas.publishableKey;
  return process.env.STRIPE_PUBLISHABLE_KEY ? String(process.env.STRIPE_PUBLISHABLE_KEY).trim() : '';
}

function stripeConfigurado() {
  return Boolean(obtenerLlaveSecreta() && obtenerLlavePublica());
}

function enmascararLlave(llave) {
  if (!llave || typeof llave !== 'string') return null;
  const limpia = llave.trim();
  if (!limpia) return null;
  return `${limpia.slice(0, 12)}...****`;
}

function obtenerEstadoPasarela() {
  const guardadas = leerCredencialesGuardadas();
  const publishableKey = obtenerLlavePublica();
  const secretKey = obtenerLlaveSecreta();
  const habilitado = Boolean(publishableKey && secretKey);
  const origen = guardadas ? 'panel_dueno' : (habilitado ? 'servidor_env' : 'sin_configurar');
  const modo = publishableKey.startsWith('pk_live_')
    ? 'PRODUCCION'
    : (publishableKey ? 'PRUEBA' : 'INACTIVO');

  return {
    habilitado,
    publishableKey: habilitado ? publishableKey : null,
    secretKeyMasked: habilitado ? enmascararLlave(secretKey) : null,
    origen,
    modo
  };
}

function guardarCredencialesPasarela({ publishableKey, secretKey }) {
  const pk = String(publishableKey ?? '').trim();
  const sk = String(secretKey ?? '').trim();

  const matchPk = pk.match(REGEX_PK);
  if (!matchPk) {
    const err = new Error('La Clave Pública debe iniciar con pk_test_ o pk_live_.');
    err.statusCode = 400;
    throw err;
  }

  const matchSk = sk.match(REGEX_SK);
  if (!matchSk) {
    const err = new Error('La Clave Secreta debe iniciar con sk_test_, rk_test_, sk_live_ o rk_live_.');
    err.statusCode = 400;
    throw err;
  }

  if (matchPk[1] !== matchSk[2]) {
    const err = new Error('Ambas claves deben pertenecer al mismo entorno (test con test, o live con live).');
    err.statusCode = 400;
    throw err;
  }

  overrideCredenciales = { publishableKey: pk, secretKey: sk };
  try {
    fs.writeFileSync(
      CONFIG_KEYS_PATH,
      JSON.stringify({ publishableKey: pk, secretKey: sk, actualizadoEn: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('No se pudo persistir archivo local de Stripe:', error);
  }

  return obtenerEstadoPasarela();
}

function restaurarCredencialesServidor() {
  overrideCredenciales = null;
  try {
    if (fs.existsSync(CONFIG_KEYS_PATH)) {
      fs.unlinkSync(CONFIG_KEYS_PATH);
    }
  } catch (error) {
    console.error('No se pudo eliminar archivo local de Stripe:', error);
  }
  return obtenerEstadoPasarela();
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
  if (!stripeConfigurado()) {
    // Si la pasarela Stripe no tiene credenciales en el entorno, simula el reembolso en modo prueba
    return { id: `re_${String(paymentIntentId).replace(/[^A-Za-z0-9_]/g, '')}`, status: 'succeeded' };
  }
  return llamarStripe('/refunds', {
    payment_intent: String(paymentIntentId)
  });
}

module.exports = {
  stripeConfigurado,
  obtenerLlavePublica,
  enmascararLlave,
  obtenerEstadoPasarela,
  guardarCredencialesPasarela,
  restaurarCredencialesServidor,
  crearPaymentIntentReserva,
  obtenerPaymentIntent,
  reembolsarPaymentIntent
};
