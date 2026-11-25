function obtenerIpCliente(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function cabecerasSeguridad(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');
  next();
}

function crearLimitadorTasa({
  nombre = 'api',
  ventanaMs = 60 * 1000,
  maxPeticiones = 120,
  mensaje = 'Demasiadas solicitudes desde esta dirección IP. Espere unos segundos e intente nuevamente.'
}) {
  const registros = new Map();

  const limpiarExpirados = setInterval(() => {
    const ahora = Date.now();
    for (const [clave, entrada] of registros.entries()) {
      if (ahora >= entrada.reiniciaEn) {
        registros.delete(clave);
      }
    }
  }, Math.max(ventanaMs, 30000));
  if (typeof limpiarExpirados.unref === 'function') {
    limpiarExpirados.unref();
  }

  return function middlewareRateLimit(req, res, next) {
    const ip = obtenerIpCliente(req);
    const clave = `${nombre}:${ip}`;
    const ahora = Date.now();
    let entrada = registros.get(clave);

    if (!entrada || ahora >= entrada.reiniciaEn) {
      entrada = { cuenta: 0, reiniciaEn: ahora + ventanaMs };
      registros.set(clave, entrada);
    }

    entrada.cuenta += 1;
    const restantes = Math.max(0, maxPeticiones - entrada.cuenta);
    const segundosRestantes = Math.max(1, Math.ceil((entrada.reiniciaEn - ahora) / 1000));

    res.setHeader('X-RateLimit-Limit', String(maxPeticiones));
    res.setHeader('X-RateLimit-Remaining', String(restantes));
    res.setHeader('X-RateLimit-Reset', String(segundosRestantes));

    if (entrada.cuenta > maxPeticiones) {
      res.setHeader('Retry-After', String(segundosRestantes));
      return res.status(429).json({
        error: mensaje,
        reintentarEnSegundos: segundosRestantes
      });
    }

    return next();
  };
}

module.exports = {
  cabecerasSeguridad,
  crearLimitadorTasa
};
