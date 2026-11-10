const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'espacios.json');

const DEFAULT_CONFIG = {
  capacidadAutos: Number(process.env.CAPACIDAD_AUTOS) || 10,
  capacidadMotos: Number(process.env.CAPACIDAD_MOTOS) || 10
};

function parsearCapacidad(valor, porDefecto) {
  const num = Number(valor);
  return Number.isFinite(num) && num >= 0 ? num : porDefecto;
}

function obtenerCapacidad() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const contenido = fs.readFileSync(CONFIG_PATH, 'utf8');
      const data = JSON.parse(contenido);
      return {
        capacidadAutos: parsearCapacidad(data.capacidadAutos, DEFAULT_CONFIG.capacidadAutos),
        capacidadMotos: parsearCapacidad(data.capacidadMotos, DEFAULT_CONFIG.capacidadMotos)
      };
    }
  } catch (error) {
    console.error('Error al leer configuración de espacios:', error);
  }
  return { ...DEFAULT_CONFIG };
}

function guardarCapacidad(nuevaCapacidad) {
  const actual = obtenerCapacidad();
  const actualizada = {
    capacidadAutos: nuevaCapacidad.capacidadAutos !== undefined && Number.isFinite(Number(nuevaCapacidad.capacidadAutos)) && Number(nuevaCapacidad.capacidadAutos) >= 0
      ? Number(nuevaCapacidad.capacidadAutos)
      : actual.capacidadAutos,
    capacidadMotos: nuevaCapacidad.capacidadMotos !== undefined && Number.isFinite(Number(nuevaCapacidad.capacidadMotos)) && Number(nuevaCapacidad.capacidadMotos) >= 0
      ? Number(nuevaCapacidad.capacidadMotos)
      : actual.capacidadMotos
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(actualizada, null, 2), 'utf8');
  return actualizada;
}

module.exports = {
  obtenerCapacidad,
  guardarCapacidad,
  DEFAULT_CONFIG
};
