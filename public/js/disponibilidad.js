/**
 * Módulo de Vista Pública de Disponibilidad de Espacios (UPAO-20)
 * Permite a cualquier conductor consultar cupos libres para autos y motos en tiempo real.
 */

(function () {
  let pollingTimeout = null;
  let pollingActivo = false;
  let avisoErrorMostrado = false;

  const cardAutos = document.getElementById('card-disponibilidad-autos');
  const cardMotos = document.getElementById('card-disponibilidad-motos');

  const badgeEstadoAutos = document.getElementById('badge-estado-autos');
  const badgeEstadoMotos = document.getElementById('badge-estado-motos');

  const dispCapacidadAutos = document.getElementById('disp-capacidad-autos');
  const dispEnCocheraAutos = document.getElementById('disp-encochera-autos');
  const dispReservasAutos = document.getElementById('disp-reservas-autos');
  const dispCuposAutos = document.getElementById('disp-cupos-autos');
  const dispTextoAutos = document.getElementById('disp-texto-autos');
  const cuposBoxAutos = document.getElementById('cupos-box-autos');
  const dispActualizadoAutos = document.getElementById('disp-actualizado-autos');

  const dispCapacidadMotos = document.getElementById('disp-capacidad-motos');
  const dispEnCocheraMotos = document.getElementById('disp-encochera-motos');
  const dispReservasMotos = document.getElementById('disp-reservas-motos');
  const dispCuposMotos = document.getElementById('disp-cupos-motos');
  const dispTextoMotos = document.getElementById('disp-texto-motos');
  const cuposBoxMotos = document.getElementById('cupos-box-motos');
  const dispActualizadoMotos = document.getElementById('disp-actualizado-motos');

  const btnVolverDisponibilidad = document.getElementById('btn-volver-disponibilidad');

  function formatearHora(isoString) {
    if (!isoString) return '--:--:--';
    try {
      const fecha = new Date(isoString);
      return fecha.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/Lima'
      });
    } catch (_) {
      return '--:--:--';
    }
  }

  function limpiarHashDisponibilidad() {
    if (window.location.hash === '#disponibilidad') {
      window.location.hash = '';
    }
  }

  function escribirSiCambia(elemento, valor) {
    if (!elemento) return;
    const texto = String(valor);
    if (elemento.textContent !== texto) elemento.textContent = texto;
  }

  function renderizarPanel(tipo, data, horaActualizacion) {
    const esAuto = tipo === 'autos';
    const card = esAuto ? cardAutos : cardMotos;
    const badge = esAuto ? badgeEstadoAutos : badgeEstadoMotos;
    const elCapacidad = esAuto ? dispCapacidadAutos : dispCapacidadMotos;
    const elEnCochera = esAuto ? dispEnCocheraAutos : dispEnCocheraMotos;
    const elReservas = esAuto ? dispReservasAutos : dispReservasMotos;
    const elCupos = esAuto ? dispCuposAutos : dispCuposMotos;
    const elTexto = esAuto ? dispTextoAutos : dispTextoMotos;
    const box = esAuto ? cuposBoxAutos : cuposBoxMotos;
    const elActualizado = esAuto ? dispActualizadoAutos : dispActualizadoMotos;

    if (!card) return;

    const capacidad = Number(data.capacidad) || 0;
    const enCochera = Number(data.enCochera) || 0;
    const reservas = Number(data.reservasVigentes) || 0;
    const disponibles = Math.max(0, Number(data.disponibles) || 0);

    escribirSiCambia(elCapacidad, capacidad);
    escribirSiCambia(elEnCochera, enCochera);
    escribirSiCambia(elReservas, reservas);
    escribirSiCambia(elCupos, disponibles);
    escribirSiCambia(elActualizado, horaActualizacion);

    // Estado Crítico: cuando los cupos se agotan (disponibles === 0)
    if (disponibles === 0) {
      card.classList.add('aforo-lleno');
      if (box) box.classList.add('lleno');

      if (badge && badge.textContent !== 'Aforo lleno') {
        badge.className = 'badge badge-danger mono';
        badge.textContent = 'Aforo lleno';
      }

      escribirSiCambia(elTexto, 'Aforo completo sin cupos');
    } else {
      // Estado Normal: con espacios disponibles
      card.classList.remove('aforo-lleno');
      if (box) box.classList.remove('lleno');

      if (badge && badge.textContent !== 'DISPONIBLE') {
        badge.className = 'badge badge-success mono';
        badge.textContent = 'DISPONIBLE';
      }

      escribirSiCambia(elTexto, disponibles === 1 ? 'espacio disponible' : 'espacios disponibles');
    }
  }

  async function cargarDisponibilidadPublica() {
    try {
      const res = await fetch('/api/publico/disponibilidad');
      if (!res.ok) {
        throw new Error('No se pudo cargar la disponibilidad.');
      }
      const data = await res.json();
      avisoErrorMostrado = false;

      const horaStr = formatearHora(data.ultimaActualizacion);

      if (data.autos) {
        renderizarPanel('autos', data.autos, horaStr);
      }
      if (data.motos) {
        renderizarPanel('motos', data.motos, horaStr);
      }
    } catch (error) {
      console.error('Error al actualizar disponibilidad pública:', error);
      if (!avisoErrorMostrado && typeof window.mostrarToast === 'function') {
        window.mostrarToast('No se pudo actualizar la disponibilidad en tiempo real.', true);
        avisoErrorMostrado = true;
      }
    } finally {
      if (pollingActivo) {
        if (pollingTimeout) clearTimeout(pollingTimeout);
        pollingTimeout = setTimeout(cargarDisponibilidadPublica, 30000);
      }
    }
  }

  /**
   * Sesión real del sistema: app.js la publica en window.sesionActual al iniciar sesión
   * y la limpia al cerrar sesión. No se consulta localStorage porque ni el login ni el
   * logout escriben ahí.
   */
  function haySesionActiva() {
    const sesion = window.sesionActual;
    return Boolean(sesion && sesion.rol);
  }

  function iniciarPolling() {
    pollingActivo = true;
    if (pollingTimeout) {
      clearTimeout(pollingTimeout);
      pollingTimeout = null;
    }
    cargarDisponibilidadPublica();
  }

  function detenerPolling() {
    pollingActivo = false;
    if (pollingTimeout) {
      clearTimeout(pollingTimeout);
      pollingTimeout = null;
    }
  }

  function inicializarEventos() {
    if (btnVolverDisponibilidad) {
      btnVolverDisponibilidad.addEventListener('click', () => {
        const autenticado = haySesionActiva();
        limpiarHashDisponibilidad();
        if (typeof window.mostrarPantalla === 'function') {
          window.mostrarPantalla(autenticado ? 'dashboard' : 'login');
        }
      });
    }
  }

  // Exponer API del módulo para integración con el ciclo de vida de la aplicación
  window.disponibilidadModulo = {
    iniciar: () => {
      iniciarPolling();
      // Ajustar texto del botón volver según si hay sesión abierta o no
      if (btnVolverDisponibilidad) {
        btnVolverDisponibilidad.textContent = haySesionActiva()
          ? '← Volver al Menú Principal'
          : '← Iniciar Sesión / Acceso de Personal';
      }
    },
    detener: () => {
      detenerPolling();
    },
    recargar: cargarDisponibilidadPublica
  };

  document.addEventListener('DOMContentLoaded', inicializarEventos);
})();
