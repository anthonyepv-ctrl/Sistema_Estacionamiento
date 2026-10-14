const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'espacios.json');

const DEFAULT_CONFIG = {
  capacidadAutos: Number(process.env.CAPACIDAD_AUTOS) || 10,
  capacidadMotos: Number(process.env.CAPACIDAD_MOTOS) || 10
};

function obtenerCapacidad() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const contenido = fs.readFileSync(CONFIG_PATH, 'utf8');
      const data = JSON.parse(contenido);
      return {
        capacidadAutos: Number(data.capacidadAutos) || DEFAULT_CONFIG.capacidadAutos,
        capacidadMotos: Number(data.capacidadMotos) || DEFAULT_CONFIG.capacidadMotos
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
    capacidadAutos: nuevaCapacidad.capacidadAutos !== undefined
      ? Number(nuevaCapacidad.capacidadAutos)
      : actual.capacidadAutos,
    capacidadMotos: nuevaCapacidad.capacidadMotos !== undefined
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
