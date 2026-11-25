const crypto = require('crypto');
const prisma = require('../config/prisma');

const REGEX_PK = /^pk_(test|live)_[A-Za-z0-9_-]{8,}$/;
const REGEX_SK = /^sk_(test|live)_[A-Za-z0-9_-]{8,}$/;

const cacheCredenciales = new Map();

function obtenerProveedorActivo() {
  return (process.env.PAYMENT_GATEWAY || 'culqi').trim().toLowerCase() || 'culqi';
}

function obtenerLlaveCifrado() {
  const secretoEnv = (process.env.PASARELA_ENCRYPTION_KEY || process.env.AUTH_SECRET || '').trim();
  return {
    secretoEnv,
    clave: crypto.createHash('sha256').update(secretoEnv || 'dev-cochera-local-key').digest()
  };
}

function cifrarSecreto(textoPlano) {
  const { clave } = obtenerLlaveCifrado();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const cifrado = Buffer.concat([cipher.update(String(textoPlano), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${cifrado.toString('hex')}`;
}

function descifrarSecreto(payload) {
  if (!payload || typeof payload !== 'string') return '';
  const partes = payload.split(':');
  if (partes.length !== 4 || partes[0] !== 'v1') {
    throw new Error('Formato de llave cifrada inválido.');
  }
  const { clave } = obtenerLlaveCifrado();
  const iv = Buffer.from(partes[1], 'hex');
  const tag = Buffer.from(partes[2], 'hex');
  const datos = Buffer.from(partes[3], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
  decipher.setAuthTag(tag);
  const plano = Buffer.concat([decipher.update(datos), decipher.final()]);
  return plano.toString('utf8');
}

function enmascararLlave(llave) {
  if (!llave || typeof llave !== 'string') return null;
  const limpia = llave.trim();
  if (!limpia) return null;
  return `${limpia.slice(0, 12)}...****`;
}

function limpiarCacheCredenciales() {
  cacheCredenciales.clear();
}

function leerCredencialesEnv(proveedor) {
  if (proveedor === 'culqi') {
    return {
      publishableKey: process.env.CULQI_PUBLIC_KEY ? String(process.env.CULQI_PUBLIC_KEY).trim() : '',
      secretKey: process.env.CULQI_SECRET_KEY ? String(process.env.CULQI_SECRET_KEY).trim() : ''
    };
  }
  return { publishableKey: '', secretKey: '' };
}

function resolverModo(publishableKey) {
  if (!publishableKey) return 'INACTIVO';
  return publishableKey.startsWith('pk_live_') ? 'PRODUCCION' : 'PRUEBA';
}

async function obtenerCredencialesActivas(proveedor = obtenerProveedorActivo()) {
  if (cacheCredenciales.has(proveedor)) {
    return cacheCredenciales.get(proveedor);
  }

  let registro = null;
  try {
    registro = await prisma.configuracionPasarela.findUnique({ where: { proveedor } });
  } catch (error) {
    console.error('Error al consultar configuracion_pasarela:', error);
  }

  if (registro && registro.llavePublica && registro.llaveSecretaCifrada) {
    try {
      const secretKey = descifrarSecreto(registro.llaveSecretaCifrada);
      const resultado = {
        proveedor,
        publishableKey: registro.llavePublica.trim(),
        secretKey: secretKey.trim(),
        origen: 'panel_dueno',
        modo: resolverModo(registro.llavePublica.trim()),
        habilitado: Boolean(registro.llavePublica.trim() && secretKey.trim())
      };
      cacheCredenciales.set(proveedor, resultado);
      return resultado;
    } catch (error) {
      console.error('No se pudo descifrar la llave secreta almacenada en BD:', error.message);
    }
  }

  const envCreds = leerCredencialesEnv(proveedor);
  const habilitado = Boolean(envCreds.publishableKey && envCreds.secretKey);
  const resultadoEnv = {
    proveedor,
    publishableKey: habilitado ? envCreds.publishableKey : '',
    secretKey: habilitado ? envCreds.secretKey : '',
    origen: habilitado ? 'servidor_env' : 'sin_configurar',
    modo: habilitado ? resolverModo(envCreds.publishableKey) : 'INACTIVO',
    habilitado
  };
  cacheCredenciales.set(proveedor, resultadoEnv);
  return resultadoEnv;
}

async function obtenerEstadoPasarela(proveedor = obtenerProveedorActivo()) {
  const creds = await obtenerCredencialesActivas(proveedor);
  return {
    habilitado: creds.habilitado,
    proveedor: creds.proveedor,
    publishableKey: creds.habilitado ? creds.publishableKey : null,
    secretKeyMasked: creds.habilitado ? enmascararLlave(creds.secretKey) : null,
    origen: creds.origen,
    modo: creds.modo
  };
}

async function guardarCredencialesPasarela({
  publishableKey,
  secretKey,
  idUsuario = null,
  proveedor = obtenerProveedorActivo()
}) {
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
    const err = new Error('La Clave Secreta debe iniciar con sk_test_ o sk_live_.');
    err.statusCode = 400;
    throw err;
  }

  if (matchPk[1] !== matchSk[1]) {
    const err = new Error('Ambas claves deben pertenecer al mismo entorno (test con test, o live con live).');
    err.statusCode = 400;
    throw err;
  }

  if (matchPk[1] === 'live') {
    const { secretoEnv } = obtenerLlaveCifrado();
    if (!secretoEnv) {
      const err = new Error('Configure PASARELA_ENCRYPTION_KEY o AUTH_SECRET en el servidor antes de guardar llaves de producción.');
      err.statusCode = 500;
      throw err;
    }
  }

  const llaveSecretaCifrada = cifrarSecreto(sk);

  await prisma.configuracionPasarela.upsert({
    where: { proveedor },
    update: {
      llavePublica: pk,
      llaveSecretaCifrada,
      actualizadoPorId: idUsuario || null
    },
    create: {
      proveedor,
      llavePublica: pk,
      llaveSecretaCifrada,
      actualizadoPorId: idUsuario || null
    }
  });

  cacheCredenciales.delete(proveedor);
  return obtenerEstadoPasarela(proveedor);
}

async function restaurarCredencialesServidor(proveedor = obtenerProveedorActivo()) {
  await prisma.configuracionPasarela.deleteMany({ where: { proveedor } });
  cacheCredenciales.delete(proveedor);
  return obtenerEstadoPasarela(proveedor);
}

module.exports = {
  obtenerProveedorActivo,
  enmascararLlave,
  obtenerCredencialesActivas,
  obtenerEstadoPasarela,
  guardarCredencialesPasarela,
  restaurarCredencialesServidor,
  limpiarCacheCredenciales
};
