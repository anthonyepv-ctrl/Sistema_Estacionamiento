function obtenerBaseUrl() {
  return (process.env.CULQI_API_BASE || 'https://api.culqi.com/v2').replace(/\/+$/, '');
}

async function llamarCulqi(ruta, bodyObj, { secretKey, idempotencyKey }) {
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json'
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(`${obtenerBaseUrl()}${ruta}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj)
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }

  if (!res.ok) {
    const msg = (data && (data.user_message || data.merchant_message || data.message))
      || 'Error al procesar la operación en Culqi.';
    const err = new Error(msg);
    err.statusCode = res.status >= 400 && res.status < 500 ? 402 : 502;
    throw err;
  }

  return data;
}

async function cobrar({ secretKey, montoSoles, sourceToken, email, idempotencyKey, metadata }) {
  const amount = Math.round(Number(montoSoles) * 100);
  if (!Number.isFinite(amount) || amount < 300) {
    const err = new Error('El monto mínimo para pagos en línea es S/ 3.00.');
    err.statusCode = 400;
    throw err;
  }

  const payload = {
    amount,
    currency_code: 'PEN',
    email,
    source_id: sourceToken,
    capture: true
  };
  if (metadata && typeof metadata === 'object') {
    payload.metadata = metadata;
  }

  const data = await llamarCulqi('/charges', payload, { secretKey, idempotencyKey });
  return {
    id: data.id,
    proveedor: 'culqi',
    estado: 'PAGADO',
    raw: data
  };
}

async function reembolsar({
  secretKey,
  chargeId,
  montoSoles,
  reason = 'solicitud_comprador',
  idempotencyKey
}) {
  const amount = Math.round(Number(montoSoles) * 100);
  const data = await llamarCulqi(
    '/refunds',
    {
      charge_id: chargeId,
      amount,
      reason
    },
    { secretKey, idempotencyKey }
  );

  return {
    id: data.id,
    proveedor: 'culqi',
    estado: 'REEMBOLSADO',
    raw: data
  };
}

module.exports = {
  cobrar,
  reembolsar
};
