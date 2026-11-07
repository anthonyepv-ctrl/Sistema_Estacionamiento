/**
 * Módulo de Vista Pública de Disponibilidad de Espacios (UPAO-20)
 * Permite a cualquier conductor consultar cupos libres para autos y motos en tiempo real.
 */

(function () {
  let pollingInterval = null;
  let datosDisponibilidad = null;

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
  const btnReservarAutos = document.getElementById('btn-reservar-autos');
  const dispActualizadoAutos = document.getElementById('disp-actualizado-autos');

  const dispCapacidadMotos = document.getElementById('disp-capacidad-motos');
  const dispEnCocheraMotos = document.getElementById('disp-encochera-motos');
  const dispReservasMotos = document.getElementById('disp-reservas-motos');
  const dispCuposMotos = document.getElementById('disp-cupos-motos');
  const dispTextoMotos = document.getElementById('disp-texto-motos');
  const cuposBoxMotos = document.getElementById('cupos-box-motos');
  const btnReservarMotos = document.getElementById('btn-reservar-motos');
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
    const btn = esAuto ? btnReservarAutos : btnReservarMotos;
    const elActualizado = esAuto ? dispActualizadoAutos : dispActualizadoMotos;

    if (!card) return;

    const capacidad = Number(data.capacidad) || 0;
    const enCochera = Number(data.enCochera) || 0;
    const reservas = Number(data.reservasVigentes) || 0;
    const disponibles = Math.max(0, Number(data.disponibles) || 0);

    if (elCapacidad) elCapacidad.textContent = capacidad;
    if (elEnCochera) elEnCochera.textContent = enCochera;
    if (elReservas) elReservas.textContent = reservas;
    if (elCupos) elCupos.textContent = disponibles;
    if (elActualizado) elActualizado.textContent = horaActualizacion;

    // Estado Crítico: cuando los cupos se agotan (disponibles === 0)
    if (disponibles === 0) {
      card.classList.add('aforo-lleno');
      if (box) box.classList.add('lleno');

      if (badge) {
        badge.className = 'badge badge-danger mono';
        badge.textContent = 'Aforo lleno';
      }

      if (elTexto) {
        elTexto.textContent = 'Aforo completo sin cupos';
      }

      if (btn) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('btn-disabled');
        btn.title = 'No hay espacios disponibles para este tipo de vehículo';
      }
    } else {
      // Estado Normal: con espacios disponibles
      card.classList.remove('aforo-lleno');
      if (box) box.classList.remove('lleno');

      if (badge) {
        badge.className = 'badge badge-success mono';
        badge.textContent = 'DISPONIBLE';
      }

      if (elTexto) {
        elTexto.textContent = disponibles === 1 ? 'espacio disponible' : 'espacios disponibles';
      }

      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
        btn.classList.remove('btn-disabled');
        btn.title = '';
      }
    }
  }

  async function cargarDisponibilidadPublica() {
    try {
      const res = await fetch('/api/publico/disponibilidad');
      if (!res.ok) {
        throw new Error('No se pudo cargar la disponibilidad.');
      }
      const data = await res.json();
      datosDisponibilidad = data;

      const horaStr = formatearHora(data.ultimaActualizacion);

      if (data.autos) {
        renderizarPanel('autos', data.autos, horaStr);
      }
      if (data.motos) {
        renderizarPanel('motos', data.motos, horaStr);
      }
    } catch (error) {
      console.error('Error al actualizar disponibilidad pública:', error);
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast('No se pudo actualizar la disponibilidad en tiempo real.', true);
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

  function manejarAccionReservar(tipo) {
    const data = datosDisponibilidad ? datosDisponibilidad[tipo] : null;

    if (!data) return;

    const disponibles = Math.max(0, Number(data.disponibles) || 0);

    // Guard de seguridad: Si no hay cupos disponibles, no se permite ninguna acción
    if (disponibles === 0) return;

    // Regla CA-06: sin sesión, "Reservar espacio" lleva a la pantalla de Login
    if (!haySesionActiva()) {
      limpiarHashDisponibilidad();
      if (typeof window.mostrarPantalla === 'function') {
        window.mostrarPantalla('login');
      }
      return;
    }

    // Con sesión iniciada la reserva en línea todavía no existe (Historia UPAO-21),
    // así que el botón informa en lugar de quedarse mudo.
    if (typeof window.mostrarToast === 'function') {
      window.mostrarToast('La reserva en línea aún no está habilitada. Por ahora la disponibilidad es solo informativa.', true);
    }
  }

  function iniciarPolling() {
    cargarDisponibilidadPublica();
    if (!pollingInterval) {
      // CA-04: Polling cada 30 segundos
      pollingInterval = setInterval(cargarDisponibilidadPublica, 30000);
    }
  }

  function detenerPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  function inicializarEventos() {
    if (btnReservarAutos) {
      btnReservarAutos.addEventListener('click', () => manejarAccionReservar('autos'));
    }
    if (btnReservarMotos) {
      btnReservarMotos.addEventListener('click', () => manejarAccionReservar('motos'));
    }

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
