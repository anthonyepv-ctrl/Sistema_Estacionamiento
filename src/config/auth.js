const crypto = require('crypto');

// Secreto de firma. En producción debe venir de AUTH_SECRET (variable de entorno del panel).
// Si no está definido se genera uno aleatorio por proceso: las sesiones dejan de sobrevivir
// a un reinicio, pero nunca queda un secreto escrito en el repositorio.
const SECRETO = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const HORAS_VIGENCIA = Number(process.env.AUTH_TTL_HORAS) || 8;
const VIGENCIA_MS = HORAS_VIGENCIA * 60 * 60 * 1000;

if (!process.env.AUTH_SECRET) {
  console.warn(
    '[auth] AUTH_SECRET no está definido: se generó un secreto aleatorio para este proceso. ' +
    'Las sesiones se invalidarán al reiniciar el servidor. Definir AUTH_SECRET en producción.'
  );
}

function firmar(cuerpo) {
  return crypto.createHmac('sha256', SECRETO).update(cuerpo).digest('base64url');
}

/**
 * Emite un token de sesión firmado (HMAC-SHA256) con vigencia limitada.
 * @param {{ id: number, usuario: string, nombre: string, rol: string }} usuario
 */
function firmarToken(usuario) {
  const payload = {
    sub: usuario.id,
    usuario: usuario.usuario,
    nombre: usuario.nombre,
    rol: usuario.rol,
    exp: Date.now() + VIGENCIA_MS
  };

  const cuerpo = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${cuerpo}.${firmar(cuerpo)}`;
}

/**
 * Valida firma y vigencia. Devuelve el payload o null.
 */
function verificarToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [cuerpo, firma] = token.split('.');
  if (!cuerpo || !firma) return null;

  const esperada = firmar(cuerpo);
  const recibida = Buffer.from(firma, 'utf8');
  const calculada = Buffer.from(esperada, 'utf8');

  if (recibida.length !== calculada.length) return null;
  if (!crypto.timingSafeEqual(recibida, calculada)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch (error) {
    return null;
  }

  if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;

  return payload;
}

function leerTokenDeCabecera(req) {
  const cabecera = req.headers.authorization || '';
  if (cabecera.startsWith('Bearer ')) {
    return cabecera.slice(7).trim() || null;
  }
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token.trim() || null;
  }
  return null;
}

/**
 * Middleware: exige un token válido y deja la sesión en req.sesion.
 */
function autenticar(req, res, next) {
  const sesion = verificarToken(leerTokenDeCabecera(req));

  if (!sesion) {
    return res.status(401).json({ error: 'Sesión no válida o expirada. Inicie sesión nuevamente.' });
  }

  req.sesion = sesion;
  return next();
}

/**
 * Middleware: restringe el acceso a los roles indicados. Debe usarse después de `autenticar`.
 */
function autorizar(...roles) {
  return (req, res, next) => {
    if (!req.sesion) {
      return res.status(401).json({ error: 'Sesión no válida o expirada. Inicie sesión nuevamente.' });
    }

    if (roles.length > 0 && !roles.includes(req.sesion.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta operación.' });
    }

    return next();
  };
}

module.exports = {
  firmarToken,
  verificarToken,
  autenticar,
  autorizar,
  ROLES: { DUENO: 'DUENO', RECEPCIONISTA: 'RECEPCIONISTA' }
};
