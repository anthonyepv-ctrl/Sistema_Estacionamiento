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
  const btnReservarAutos = document.getElementById('btn-reservar-auto') || document.getElementById('btn-reservar-autos');
  const dispActualizadoAutos = document.getElementById('disp-actualizado-autos');

  const dispCapacidadMotos = document.getElementById('disp-capacidad-motos');
  const dispEnCocheraMotos = document.getElementById('disp-encochera-motos');
  const dispReservasMotos = document.getElementById('disp-reservas-motos');
  const dispCuposMotos = document.getElementById('disp-cupos-motos');
  const dispTextoMotos = document.getElementById('disp-texto-motos');
  const cuposBoxMotos = document.getElementById('cupos-box-motos');
  const btnReservarMotos = document.getElementById('btn-reservar-moto') || document.getElementById('btn-reservar-motos');
  const dispActualizadoMotos = document.getElementById('disp-actualizado-motos');

  const btnVolverDisponibilidad = document.getElementById('btn-volver-disponibilidad');
  const topBarDisponibilidad = document.getElementById('disponibilidad-top-bar');
  const btnHeaderLogin = document.getElementById('btn-header-login');

  function formatearHora(isoString) {
    if (!isoString) return '--:--:--';
    try {
      const fecha = new Date(isoString);
      return fecha.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
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
    const elPrecio = document.getElementById(esAuto ? 'disp-precio-autos' : 'disp-precio-motos');
    const elFraccion = document.getElementById(esAuto ? 'disp-fraccion-autos' : 'disp-fraccion-motos');

    if (!card) return;

    const capacidad = Number(data.capacidad) || 0;
    const enCochera = Number(data.enCochera) || 0;
    const reservas = Number(data.reservasVigentes) || 0;
    const disponibles = Math.max(0, Number(data.disponibles) || 0);

    if (elPrecio && data.precioHora !== undefined) {
      elPrecio.textContent = `S/ ${Number(data.precioHora).toFixed(2)}`;
    }
    if (elFraccion && data.precioFraccion !== undefined) {
      const baseFraccion = `Fracción: S/ ${Number(data.precioFraccion).toFixed(2)}`;
      elFraccion.textContent = Number(data.precioHora) < 3
        ? `${baseFraccion} · Adelanto mín. online: S/ 3.00`
        : baseFraccion;
    }

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

      const heroCuposTotales = document.getElementById('hero-cupos-totales');
      if (heroCuposTotales && data.total) {
        const libres = Math.max(0, Number(data.total.disponibles) || 0);
        heroCuposTotales.textContent = `${libres} ${libres === 1 ? 'espacio libre ahora' : 'espacios libres ahora'}`;
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

    if (data) {
      const disponibles = Math.max(0, Number(data.disponibles) || 0);
      if (disponibles === 0) return;
    }

    // Regla CA-06: sin sesión, "Reservar espacio" lleva a Login y retorna directo a reservas tras autenticar
    if (!haySesionActiva()) {
      limpiarHashDisponibilidad();
      window.tipoReservaPreseleccionado = tipo === 'motos' ? 'moto' : 'auto';
      window.redirigirTrasLogin = 'conductor-reservas';
      if (typeof window.mostrarPantalla === 'function') {
        window.mostrarPantalla('login');
      }
      return;
    }

    if (window.sesionActual && window.sesionActual.rol === 'CONDUCTOR') {
      limpiarHashDisponibilidad();
      window.tipoReservaPreseleccionado = tipo === 'motos' ? 'moto' : 'auto';
      if (typeof window.mostrarPantalla === 'function') {
        window.mostrarPantalla('conductor-reservas');
      }
      return;
    }

    if (typeof window.mostrarToast === 'function') {
      window.mostrarToast('Las reservas web están destinadas a cuentas de Conductor.', true);
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

    if (btnHeaderLogin) {
      btnHeaderLogin.addEventListener('click', () => {
        window.location.hash = '#login';
        if (typeof window.mostrarPantalla === 'function') {
          window.mostrarPantalla('login');
        }
      });
    }

    if (btnVolverDisponibilidad) {
      btnVolverDisponibilidad.addEventListener('click', () => {
        limpiarHashDisponibilidad();
        if (typeof window.mostrarPantalla === 'function') {
          window.mostrarPantalla(haySesionActiva() ? 'dashboard' : 'login');
        }
      });
    }

    const TEXTOS_LEGALES = {
      terminos: {
        titulo: 'Términos y Condiciones — Cochera SP',
        html: `
          <p><strong>1. Titular del servicio:</strong> FLORES LEONARDO ALBERTH JAIR (Cochera SP, RUC 10607991664), ubicado en Av. América Sur 3145, Urb. Monserrate, Trujillo, La Libertad.</p>
          <p><strong>2. Servicio de reserva:</strong> El conductor puede reservar un espacio de estacionamiento (Automóvil o Motocicleta) abonando por adelantado el equivalente a 1 hora de tarifa vigente (mínimo S/ 3.00 en línea). Todos los precios incluyen impuestos de ley; se entrega comprobante de reserva digital y boleta de venta a solicitud en recepción.</p>
          <p><strong>3. Vigencia de la reserva:</strong> La reserva tiene una vigencia máxima de 30 minutos desde su confirmación de pago. Transcurrido ese plazo sin ingreso en recepción, la reserva expira automáticamente.</p>
          <p><strong>4. Descuento en salida:</strong> Al ingresar dentro del plazo vigente, el monto abonado por adelantado se descuenta íntegramente del total calculado al registrar la salida del vehículo.</p>
        `
      },
      privacidad: {
        titulo: 'Política de Privacidad',
        html: `
          <p><strong>1. Protección de datos personales:</strong> En cumplimiento de la Ley N.° 29733 (Ley de Protección de Datos Personales del Perú), FLORES LEONARDO ALBERTH JAIR (Cochera SP) recopila únicamente nombre, DNI, celular, correo electrónico y placa vehicular para gestionar reservas, comprobantes e ingresos.</p>
          <p><strong>2. Datos de pago:</strong> Cochera SP no almacena números de tarjeta, códigos CVV ni credenciales bancarias. Todos los pagos se procesan directamente mediante la pasarela certificada Culqi.</p>
          <p><strong>3. Derechos ARCO:</strong> El titular puede solicitar acceso, rectificación, cancelación u oposición sobre sus datos escribiendo a alberthflores47@gmail.com o llamando al +51 988 940 558.</p>
        `
      },
      reembolsos: {
        titulo: 'Política de Cambios, Anulaciones y Reembolsos',
        html: `
          <p><strong>1. Anulación con reembolso:</strong> El conductor puede anular su reserva sin penalidad desde la sección Mis Reservas siempre que se encuentre vigente (dentro de los 30 minutos) y antes de registrar el ingreso en recepción.</p>
          <p><strong>2. Devolución del importe:</strong> La anulación elegible dispara el reembolso del 100% del adelanto pagado hacia el mismo medio de pago utilizado (tarjeta o Yape vía Culqi), sujeto a los plazos de acreditación de cada entidad emisora.</p>
          <p><strong>3. Reclamos y consultas:</strong> Conforme a la Ley N.° 31435, toda hoja ingresada en nuestro Libro de Reclamaciones Virtual es respondida en un plazo máximo de 15 días hábiles.</p>
        `
      }
    };

    const modalLegal = document.getElementById('modal-legal-publico');
    const modalLegalTitulo = document.getElementById('modal-legal-titulo');
    const modalLegalContenido = document.getElementById('modal-legal-contenido');
    const btnCerrarLegal = document.getElementById('btn-cerrar-modal-legal');

    document.querySelectorAll('.link-legal-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const clave = btn.getAttribute('data-legal');
        const info = TEXTOS_LEGALES[clave];
        if (!info || !modalLegal) return;
        modalLegalTitulo.textContent = info.titulo;
        modalLegalContenido.innerHTML = info.html;
        modalLegal.classList.remove('hidden');
      });
    });

    if (btnCerrarLegal && modalLegal) {
      btnCerrarLegal.addEventListener('click', () => modalLegal.classList.add('hidden'));
      modalLegal.addEventListener('click', (e) => {
        if (e.target === modalLegal) modalLegal.classList.add('hidden');
      });
    }

    const btnAbrirReclamo = document.getElementById('btn-abrir-libro-reclamaciones');
    const modalReclamo = document.getElementById('modal-libro-reclamaciones');
    const btnCerrarReclamo = document.getElementById('btn-cerrar-modal-reclamo');
    const btnCancelarReclamo = document.getElementById('btn-cancelar-reclamo');
    const formReclamo = document.getElementById('form-libro-reclamaciones');
    const boxConstancia = document.getElementById('box-constancia-reclamo');
    const btnImprimirConstancia = document.getElementById('btn-imprimir-constancia-reclamo');
    const btnNuevoReclamo = document.getElementById('btn-nuevo-reclamo');

    function abrirModalReclamo() {
      if (!modalReclamo) return;
      if (formReclamo) formReclamo.classList.remove('hidden');
      if (boxConstancia) boxConstancia.classList.add('hidden');
      modalReclamo.classList.remove('hidden');
    }

    function cerrarModalReclamo() {
      if (modalReclamo) modalReclamo.classList.add('hidden');
    }

    if (btnAbrirReclamo) btnAbrirReclamo.addEventListener('click', abrirModalReclamo);
    if (btnCerrarReclamo) btnCerrarReclamo.addEventListener('click', cerrarModalReclamo);
    if (btnCancelarReclamo) btnCancelarReclamo.addEventListener('click', cerrarModalReclamo);
    if (modalReclamo) {
      modalReclamo.addEventListener('click', (e) => {
        if (e.target === modalReclamo) cerrarModalReclamo();
      });
    }
    if (btnImprimirConstancia) {
      btnImprimirConstancia.addEventListener('click', () => window.print());
    }
    if (btnNuevoReclamo) {
      btnNuevoReclamo.addEventListener('click', () => {
        if (formReclamo) {
          formReclamo.reset();
          formReclamo.classList.remove('hidden');
        }
        if (boxConstancia) boxConstancia.classList.add('hidden');
      });
    }

    if (formReclamo) {
      formReclamo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnEnviar = document.getElementById('btn-enviar-reclamo');
        if (btnEnviar) {
          btnEnviar.classList.add('loading');
          btnEnviar.disabled = true;
        }
        try {
          const payload = {
            tipo: document.getElementById('rec-tipo').value,
            servicio: document.getElementById('rec-servicio').value.trim(),
            nombreConsumidor: document.getElementById('rec-nombre').value.trim(),
            tipoDocumento: document.getElementById('rec-tipo-doc').value,
            numeroDocumento: document.getElementById('rec-num-doc').value.trim(),
            telefono: document.getElementById('rec-telefono').value.trim(),
            correo: document.getElementById('rec-correo').value.trim(),
            montoReclamado: document.getElementById('rec-monto').value.trim() || null,
            domicilio: document.getElementById('rec-domicilio').value.trim(),
            detalle: document.getElementById('rec-detalle').value.trim(),
            pedido: document.getElementById('rec-pedido').value.trim()
          };

          const resp = await fetch('/api/publico/reclamos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            throw new Error(data.error || 'No se pudo registrar la hoja de reclamación.');
          }

          document.getElementById('rec-constancia-codigo').textContent = data.reclamo.codigo;
          document.getElementById('rec-constancia-nombre').textContent = data.reclamo.nombreConsumidor;
          document.getElementById('rec-constancia-fecha').textContent =
            typeof window.formatearFechaHoraPeru === 'function'
              ? window.formatearFechaHoraPeru(data.reclamo.creadoEn)
              : new Date(data.reclamo.creadoEn).toLocaleString('es-PE', { timeZone: 'America/Lima', hourCycle: 'h23' });

          formReclamo.classList.add('hidden');
          if (boxConstancia) boxConstancia.classList.remove('hidden');
          if (typeof window.mostrarToast === 'function') {
            window.mostrarToast(data.mensaje || `Reclamo ${data.reclamo.codigo} registrado.`);
          }
        } catch (err) {
          if (typeof window.mostrarToast === 'function') {
            window.mostrarToast(err.message, true);
          }
        } finally {
          if (btnEnviar) {
            btnEnviar.classList.remove('loading');
            btnEnviar.disabled = false;
          }
        }
      });
    }
  }

  // Exponer API del módulo para integración con el ciclo de vida de la aplicación
  window.disponibilidadModulo = {
    iniciar: () => {
      iniciarPolling();
      const autenticado = haySesionActiva();
      const viewDisp = document.getElementById('view-disponibilidad');
      const enModoPanel = Boolean(viewDisp && viewDisp.classList.contains('modo-panel-aforo'));
      if (topBarDisponibilidad) {
        topBarDisponibilidad.classList.toggle('hidden', !autenticado || !enModoPanel);
      }
      if (btnHeaderLogin) {
        btnHeaderLogin.classList.toggle('hidden', autenticado);
      }
    },
    detener: () => {
      detenerPolling();
      if (btnHeaderLogin) {
        btnHeaderLogin.classList.add('hidden');
      }
    },
    recargar: cargarDisponibilidadPublica
  };

  document.addEventListener('DOMContentLoaded', inicializarEventos);
})();
