(function () {
  let stripeInstance = null;
  let stripeElements = null;
  let stripeCardElement = null;
  let configPasarela = null;
  let intencionActual = null;
  let vehiculosConductor = [];
  let reservaParaAnular = null;

  function formatearFechaHora(iso) {
    if (!iso) return '—';
    const f = new Date(iso);
    if (Number.isNaN(f.getTime())) return '—';
    return f.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatearSoles(monto) {
    return `S/ ${Number(monto || 0).toFixed(2)}`;
  }

  function normalizarPlacaInput(valor) {
    const limpio = String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (limpio.length > 3) {
      return `${limpio.slice(0, 3)}-${limpio.slice(3)}`;
    }
    return limpio;
  }

  function badgeEstadoReserva(estado) {
    if (estado === 'VIGENTE') {
      return '<span class="badge badge-success mono">VIGENTE</span>';
    }
    if (estado === 'UTILIZADA') {
      return '<span class="badge badge-primary mono" style="background:#DBEAFE;color:#1E3A8A;">UTILIZADA</span>';
    }
    if (estado === 'ANULADA') {
      return '<span class="badge badge-danger mono">ANULADA</span>';
    }
    if (estado === 'VENCIDA') {
      return '<span class="badge badge-warning mono" style="background:#FEF3C7;color:#92400E;">VENCIDA</span>';
    }
    return `<span class="badge mono">${estado || '—'}</span>`;
  }

  async function inicializarStripeSiHaceFalta() {
    if (stripeInstance && stripeCardElement) return true;

    if (!configPasarela) {
      configPasarela = await window.pedirApi('/api/reservas/config-pasarela');
    }

    if (!configPasarela || !configPasarela.habilitado || !configPasarela.publishableKey) {
      throw new Error('La pasarela de pagos con tarjeta no está configurada en el servidor.');
    }

    if (typeof window.Stripe !== 'function') {
      throw new Error('No se pudo cargar el formulario seguro de tarjeta. Verifique su conexión a internet.');
    }

    stripeInstance = window.Stripe(configPasarela.publishableKey);
    stripeElements = stripeInstance.elements({ locale: 'es' });
    stripeCardElement = stripeElements.create('card', {
      hidePostalCode: true,
      style: {
        base: {
          color: '#0F172A',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '13.5px',
          '::placeholder': { color: '#94A3B8' }
        },
        invalid: {
          color: '#EF4444',
          iconColor: '#EF4444'
        }
      }
    });

    const contenedorCard = document.getElementById('stripe-card-element');
    if (contenedorCard) {
      contenedorCard.innerHTML = '';
      stripeCardElement.mount('#stripe-card-element');
      stripeCardElement.on('change', (ev) => {
        const errDiv = document.getElementById('stripe-card-errors');
        if (errDiv) {
          errDiv.textContent = ev.error ? ev.error.message : '';
        }
      });
    }

    return true;
  }

  async function cargarVehiculosConductor() {
    const tbody = document.getElementById('tbody-vehiculos-conductor');
    const selectReserva = document.getElementById('reserva-vehiculo-select');

    try {
      const data = await window.pedirApi('/api/conductor/vehiculos');
      vehiculosConductor = data.vehiculos || [];

      if (tbody) {
        if (vehiculosConductor.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="caption" style="text-align:center;">Aún no tiene vehículos registrados.</td></tr>';
        } else {
          tbody.innerHTML = vehiculosConductor.map((v) => `
            <tr>
              <td class="mono" style="font-weight:700;">${v.placa}</td>
              <td>${v.tipo}</td>
              <td class="text-right">
                <button type="button" class="btn btn-secondary btn-sm btn-eliminar-vehiculo" data-id="${v.id}" data-placa="${v.placa}">
                  Eliminar
                </button>
              </td>
            </tr>
          `).join('');

          tbody.querySelectorAll('.btn-eliminar-vehiculo').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              btn.disabled = true;
              try {
                const res = await window.pedirApi(`/api/conductor/vehiculos/${id}`, { method: 'DELETE' });
                window.mostrarToast(res.mensaje || 'Vehículo eliminado.');
                await cargarVehiculosConductor();
              } catch (err) {
                window.mostrarToast(err.message, true);
                btn.disabled = false;
              }
            });
          });
        }
      }

      if (selectReserva) {
        const valorPrevio = selectReserva.value;
        selectReserva.innerHTML = '<option value="">-- Seleccione un vehículo registrado --</option>' +
          vehiculosConductor.map((v) => `<option value="${v.id}" data-tipo="${v.tipoCodigo}">${v.placa} — ${v.tipo}</option>`).join('');

        if (window.tipoReservaPreseleccionado) {
          const candidato = vehiculosConductor.find((v) => v.tipoCodigo === window.tipoReservaPreseleccionado);
          if (candidato) {
            selectReserva.value = String(candidato.id);
          }
          window.tipoReservaPreseleccionado = null;
        } else if (valorPrevio && vehiculosConductor.some((v) => String(v.id) === String(valorPrevio))) {
          selectReserva.value = valorPrevio;
        } else if (vehiculosConductor.length === 1) {
          selectReserva.value = String(vehiculosConductor[0].id);
        }

        actualizarVistaPreviaAdelanto();
      }

      const hintSinVeh = document.getElementById('hint-sin-vehiculos-reserva');
      if (hintSinVeh) {
        hintSinVeh.classList.toggle('hidden', vehiculosConductor.length > 0);
      }

      if (vehiculosConductor.length === 0) {
        const inputPlacaNew = document.getElementById('vehiculo-placa');
        if (inputPlacaNew && document.getElementById('view-conductor-reservas')?.classList.contains('active')) {
          inputPlacaNew.focus();
        }
      }
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="3" class="caption" style="text-align:center;color:#EF4444;">${err.message}</td></tr>`;
      }
    }
  }

  function actualizarVistaPreviaAdelanto() {
    const selectReserva = document.getElementById('reserva-vehiculo-select');
    const boxResumen = document.getElementById('box-resumen-adelanto');
    const elMonto = document.getElementById('reserva-monto-adelanto');
    if (!selectReserva || !boxResumen || !elMonto) return;

    const idSel = Number(selectReserva.value);
    const veh = vehiculosConductor.find((v) => v.id === idSel);
    if (!veh || veh.precioAdelanto === null || veh.precioAdelanto === undefined) {
      boxResumen.classList.add('hidden');
      return;
    }

    elMonto.textContent = formatearSoles(veh.precioAdelanto);
    boxResumen.classList.remove('hidden');
  }

  async function cargarMisReservas() {
    const tbody = document.getElementById('tbody-mis-reservas');
    if (!tbody) return;

    try {
      const data = await window.pedirApi('/api/reservas/mias');
      const reservas = data.reservas || [];

      if (reservas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="caption" style="text-align:center;">No registra reservas hasta el momento.</td></tr>';
        return;
      }

      tbody.innerHTML = reservas.map((r) => {
        const puedeAnular = r.estado === 'VIGENTE';
        return `
          <tr>
            <td class="mono" style="font-weight:700;">${r.codigo}</td>
            <td class="mono">${r.placa}</td>
            <td>${r.tipo}</td>
            <td class="mono">${formatearFechaHora(r.fechaReserva)}</td>
            <td class="mono">${formatearFechaHora(r.fechaLimite)}</td>
            <td class="text-right mono">${formatearSoles(r.montoAdelanto)}</td>
            <td>${badgeEstadoReserva(r.estado)}</td>
            <td class="text-right">
              ${puedeAnular ? `
                <button type="button" class="btn btn-danger btn-sm btn-abrir-anular-reserva"
                  data-id="${r.id}"
                  data-codigo="${r.codigo}"
                  data-placa="${r.placa}"
                  data-monto="${r.montoAdelanto}">
                  Anular Reserva
                </button>
              ` : '<span class="caption">—</span>'}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-abrir-anular-reserva').forEach((btn) => {
        btn.addEventListener('click', () => {
          abrirModalAnularReserva({
            id: Number(btn.getAttribute('data-id')),
            codigo: btn.getAttribute('data-codigo'),
            placa: btn.getAttribute('data-placa'),
            montoAdelanto: Number(btn.getAttribute('data-monto'))
          });
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="caption" style="text-align:center;color:#EF4444;">${err.message}</td></tr>`;
    }
  }

  function abrirModalAnularReserva(reserva) {
    reservaParaAnular = reserva;
    const modal = document.getElementById('modal-anular-reserva');
    const elCodigo = document.getElementById('modal-anular-codigo');
    const elPlaca = document.getElementById('modal-anular-placa');
    const elMonto = document.getElementById('modal-anular-monto');

    if (elCodigo) elCodigo.textContent = reserva.codigo;
    if (elPlaca) elPlaca.textContent = reserva.placa;
    if (elMonto) elMonto.textContent = formatearSoles(reserva.montoAdelanto);
    if (modal) modal.classList.remove('hidden');
  }

  function cerrarModalAnularReserva() {
    reservaParaAnular = null;
    const modal = document.getElementById('modal-anular-reserva');
    if (modal) modal.classList.add('hidden');
  }

  async function cargarVistaConductor() {
    ocultarCheckoutStripe();
    await Promise.all([
      cargarVehiculosConductor(),
      cargarMisReservas()
    ]);
  }

  function ocultarCheckoutStripe() {
    intencionActual = null;
    const modalPago = document.getElementById('modal-pago-reserva');
    const errDiv = document.getElementById('stripe-card-errors');
    if (modalPago) modalPago.classList.add('hidden');
    if (errDiv) errDiv.textContent = '';
    if (stripeCardElement && typeof stripeCardElement.clear === 'function') {
      stripeCardElement.clear();
    }
  }

  async function cargarHistorialConductor() {
    const tbody = document.getElementById('tbody-historial-conductor');
    if (!tbody) return;

    try {
      const data = await window.pedirApi('/api/conductor/historial');
      const estadias = data.estadias || [];

      if (estadias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="caption" style="text-align:center;">Aún no registra estadías con sus vehículos.</td></tr>';
        return;
      }

      tbody.innerHTML = estadias.map((e) => {
        const badge = e.estado === 'En cochera'
          ? '<span class="badge badge-success mono">EN COCHERA</span>'
          : '<span class="badge mono" style="background:#E2E8F0;color:#334155;">FINALIZADA</span>';

        return `
          <tr>
            <td class="mono" style="font-weight:700;">${e.placa}</td>
            <td>${e.tipo}</td>
            <td class="mono">${formatearFechaHora(e.horaIngreso)}</td>
            <td class="mono">${e.horaSalida ? formatearFechaHora(e.horaSalida) : 'En cochera'}</td>
            <td class="mono">${e.codigoReserva || '—'}</td>
            <td class="text-right mono">${e.montoAdelanto > 0 ? formatearSoles(e.montoAdelanto) : 'S/ 0.00'}</td>
            <td class="text-right mono">${e.montoPagado !== null ? formatearSoles(e.montoPagado) : 'Pendiente'}</td>
            <td>${badge}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="caption" style="text-align:center;color:#EF4444;">${err.message}</td></tr>`;
    }
  }

  async function cargarGaritaReservas() {
    const tbody = document.getElementById('tbody-garita-reservas');
    const inputQ = document.getElementById('input-buscar-reserva-garita');
    const selectEstado = document.getElementById('select-estado-reserva-garita');
    const caption = document.getElementById('caption-resultados-garita');
    if (!tbody) return;

    const q = inputQ ? inputQ.value.trim() : '';
    const estado = selectEstado ? selectEstado.value : 'TODOS';

    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (estado && estado !== 'TODOS') params.set('estado', estado);

      const data = await window.pedirApi(`/api/reservas?${params.toString()}`);
      const reservas = data.reservas || [];

      if (caption) {
        caption.textContent = reservas.length === 0
          ? 'No se encontraron reservas con el criterio ingresado.'
          : `Mostrando ${reservas.length} reserva(s) encontrada(s)`;
      }

      if (reservas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="caption" style="text-align:center;">No se encontraron reservas para el criterio ingresado.</td></tr>';
        return;
      }

      tbody.innerHTML = reservas.map((r) => {
        const puedeConfirmar = r.estado === 'VIGENTE';
        const nombreCond = r.conductor ? r.conductor.nombre : '—';
        const dniCond = r.conductor && r.conductor.dni ? r.conductor.dni : '—';
        return `
          <tr>
            <td class="mono" style="font-weight:700;">${r.codigo}</td>
            <td class="mono" style="font-weight:700;">${r.placa}</td>
            <td>${r.tipo}</td>
            <td>${nombreCond} <span class="caption mono">(${dniCond})</span></td>
            <td class="mono">${formatearFechaHora(r.fechaReserva)}</td>
            <td class="mono">${formatearFechaHora(r.fechaLimite)}</td>
            <td class="text-right mono">${formatearSoles(r.montoAdelanto)}</td>
            <td>${badgeEstadoReserva(r.estado)}</td>
            <td class="text-right">
              ${puedeConfirmar ? `
                <button type="button" class="btn btn-primary btn-sm btn-confirmar-reserva-garita"
                  data-id="${r.id}"
                  data-codigo="${r.codigo}"
                  data-placa="${r.placa}">
                  Confirmar Ingreso
                </button>
              ` : '<span class="caption">—</span>'}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-confirmar-reserva-garita').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          btn.classList.add('loading');
          btn.disabled = true;
          try {
            const res = await window.pedirApi(`/api/reservas/${id}/confirmar`, {
              method: 'POST',
              body: JSON.stringify({})
            });
            window.mostrarToast(res.mensaje || 'Reserva confirmada e ingreso registrado.');
            await cargarGaritaReservas();
          } catch (err) {
            window.mostrarToast(err.message, true);
            btn.classList.remove('loading');
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="caption" style="text-align:center;color:#EF4444;">${err.message}</td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Toggle Login <-> Registro de Conductor
    const btnIrRegistro = document.getElementById('btn-ir-registro-conductor');
    const btnVolverLogin = document.getElementById('btn-volver-login-desde-registro');
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro-conductor');

    if (btnIrRegistro && formLogin && formRegistro) {
      btnIrRegistro.addEventListener('click', () => {
        formLogin.classList.add('hidden');
        formRegistro.classList.remove('hidden');
      });
    }

    if (btnVolverLogin && formLogin && formRegistro) {
      btnVolverLogin.addEventListener('click', () => {
        formRegistro.classList.add('hidden');
        formLogin.classList.remove('hidden');
      });
    }

    // 2. Submit Registro de Conductor
    if (formRegistro) {
      formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('reg-nombre').value.trim();
        const dni = document.getElementById('reg-dni').value.trim();
        const celular = document.getElementById('reg-celular').value.trim();
        const usuario = document.getElementById('reg-usuario').value.trim();
        const contrasena = document.getElementById('reg-password').value.trim();
        const btnSubmit = document.getElementById('btn-registro-conductor-submit');

        btnSubmit.classList.add('loading');
        btnSubmit.disabled = true;

        try {
          const sesion = await window.pedirApi('/api/auth/registro-conductor', {
            method: 'POST',
            body: JSON.stringify({ nombre, dni, celular, usuario, contrasena })
          });

          if (typeof window.activarSesion === 'function') {
            window.activarSesion(sesion);
          }
          formRegistro.reset();
          formRegistro.classList.add('hidden');
          if (formLogin) formLogin.classList.remove('hidden');

          window.mostrarToast(`Bienvenido, ${sesion.nombre}. Su cuenta de conductor fue creada.`);
          window.mostrarPantalla('conductor-reservas');
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btnSubmit.classList.remove('loading');
          btnSubmit.disabled = false;
        }
      });
    }

    // 3. Tarjetas del Dashboard y botones de navegación
    const cardConductorReservas = document.getElementById('card-modulo-conductor-reservas');
    if (cardConductorReservas) {
      cardConductorReservas.addEventListener('click', () => window.mostrarPantalla('conductor-reservas'));
    }

    const cardConductorHistorial = document.getElementById('card-modulo-conductor-historial');
    if (cardConductorHistorial) {
      cardConductorHistorial.addEventListener('click', () => window.mostrarPantalla('conductor-historial'));
    }

    const cardGaritaReservas = document.getElementById('card-modulo-garita-reservas');
    if (cardGaritaReservas) {
      cardGaritaReservas.addEventListener('click', () => window.mostrarPantalla('garita-reservas'));
    }

    const btnVolverMenuReservas = document.getElementById('btn-volver-menu-desde-conductor-reservas');
    if (btnVolverMenuReservas) {
      btnVolverMenuReservas.addEventListener('click', () => window.mostrarPantalla('dashboard'));
    }

    const btnIrHistorialDesdeReservas = document.getElementById('btn-ir-historial-desde-reservas');
    if (btnIrHistorialDesdeReservas) {
      btnIrHistorialDesdeReservas.addEventListener('click', () => window.mostrarPantalla('conductor-historial'));
    }

    const btnVolverMenuHistorial = document.getElementById('btn-volver-menu-desde-conductor-historial');
    if (btnVolverMenuHistorial) {
      btnVolverMenuHistorial.addEventListener('click', () => window.mostrarPantalla('dashboard'));
    }

    const btnIrReservasDesdeHistorial = document.getElementById('btn-ir-reservas-desde-historial');
    if (btnIrReservasDesdeHistorial) {
      btnIrReservasDesdeHistorial.addEventListener('click', () => window.mostrarPantalla('conductor-reservas'));
    }

    const btnVolverMenuGarita = document.getElementById('btn-volver-menu-desde-garita-reservas');
    if (btnVolverMenuGarita) {
      btnVolverMenuGarita.addEventListener('click', () => window.mostrarPantalla('dashboard'));
    }

    // 4. Formulario Registrar Vehículo del Conductor
    const inputPlacaVehiculo = document.getElementById('vehiculo-placa');
    if (inputPlacaVehiculo) {
      inputPlacaVehiculo.addEventListener('input', () => {
        inputPlacaVehiculo.value = normalizarPlacaInput(inputPlacaVehiculo.value);
      });
    }

    const formVehiculo = document.getElementById('form-vehiculo-conductor');
    if (formVehiculo) {
      formVehiculo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const placa = inputPlacaVehiculo ? inputPlacaVehiculo.value.trim() : '';
        const tipo = document.getElementById('vehiculo-tipo').value;
        const btn = document.getElementById('btn-guardar-vehiculo');

        btn.classList.add('loading');
        btn.disabled = true;

        try {
          const res = await window.pedirApi('/api/conductor/vehiculos', {
            method: 'POST',
            body: JSON.stringify({ placa, tipo })
          });
          if (inputPlacaVehiculo) inputPlacaVehiculo.value = '';
          window.mostrarToast(res.mensaje || 'Vehículo registrado.');
          await cargarVehiculosConductor();
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btn.classList.remove('loading');
          btn.disabled = false;
        }
      });
    }

    // 5. Preparar intención de pago Stripe (UPAO-21)
    const selectVehiculoReserva = document.getElementById('reserva-vehiculo-select');
    if (selectVehiculoReserva) {
      selectVehiculoReserva.addEventListener('change', () => {
        ocultarCheckoutStripe();
        actualizarVistaPreviaAdelanto();
      });
    }

    const btnPrepararPago = document.getElementById('btn-preparar-pago-stripe');
    if (btnPrepararPago) {
      btnPrepararPago.addEventListener('click', async () => {
        const selectVehiculo = document.getElementById('reserva-vehiculo-select');
        const idVehiculo = selectVehiculo ? Number(selectVehiculo.value) : 0;

        if (!idVehiculo) {
          window.mostrarToast('Seleccione primero uno de sus vehículos registrados.', true);
          return;
        }

        btnPrepararPago.classList.add('loading');
        btnPrepararPago.disabled = true;

        try {
          await inicializarStripeSiHaceFalta();

          intencionActual = await window.pedirApi('/api/reservas/intencion-pago', {
            method: 'POST',
            body: JSON.stringify({ idVehiculo })
          });

          const elMonto = document.getElementById('reserva-monto-adelanto');
          if (elMonto) elMonto.textContent = formatearSoles(intencionActual.montoAdelanto);

          const modalPagoVeh = document.getElementById('modal-pago-vehiculo');
          const modalPagoMonto = document.getElementById('modal-pago-monto');
          const vehSel = vehiculosConductor.find((v) => v.id === idVehiculo);
          if (modalPagoVeh) modalPagoVeh.textContent = vehSel ? `${vehSel.placa} (${vehSel.tipo})` : 'Vehículo seleccionado';
          if (modalPagoMonto) modalPagoMonto.textContent = formatearSoles(intencionActual.montoAdelanto);

          const modalPago = document.getElementById('modal-pago-reserva');
          if (modalPago) modalPago.classList.remove('hidden');
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btnPrepararPago.classList.remove('loading');
          btnPrepararPago.disabled = false;
        }
      });
    }

    const btnCancelarCheckout = document.getElementById('btn-cancelar-checkout-stripe');
    if (btnCancelarCheckout) {
      btnCancelarCheckout.addEventListener('click', () => {
        ocultarCheckoutStripe();
      });
    }

    // 6. Confirmar pago en Stripe y crear Reserva (UPAO-21)
    const formCrearReserva = document.getElementById('form-crear-reserva');
    if (formCrearReserva) {
      formCrearReserva.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!intencionActual || !stripeInstance || !stripeCardElement) {
          window.mostrarToast('Primero prepare el pago con tarjeta.', true);
          return;
        }

        const btnConfirmar = document.getElementById('btn-confirmar-pago-reserva');
        const errDiv = document.getElementById('stripe-card-errors');
        if (errDiv) errDiv.textContent = '';

        btnConfirmar.classList.add('loading');
        btnConfirmar.disabled = true;

        try {
          const resultadoStripe = await stripeInstance.confirmCardPayment(intencionActual.clientSecret, {
            payment_method: {
              card: stripeCardElement
            }
          });

          if (resultadoStripe.error) {
            if (errDiv) errDiv.textContent = resultadoStripe.error.message;
            throw new Error(resultadoStripe.error.message || 'La tarjeta fue rechazada.');
          }

          if (!resultadoStripe.paymentIntent || resultadoStripe.paymentIntent.status !== 'succeeded') {
            throw new Error('El pago no pudo completarse con la tarjeta.');
          }

          const selectVehiculo = document.getElementById('reserva-vehiculo-select');
          const idVehiculo = Number(selectVehiculo.value);

          const respuestaReserva = await window.pedirApi('/api/reservas', {
            method: 'POST',
            body: JSON.stringify({
              idVehiculo,
              paymentIntentId: resultadoStripe.paymentIntent.id
            })
          });

          window.mostrarToast(respuestaReserva.mensaje || 'Reserva creada exitosamente.');
          ocultarCheckoutStripe();
          await cargarMisReservas();
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btnConfirmar.classList.remove('loading');
          btnConfirmar.disabled = false;
        }
      });
    }

    // 7. Modal de Anulación de Reserva (UPAO-22)
    const btnCerrarModalAnular = document.getElementById('btn-cerrar-modal-anular');
    if (btnCerrarModalAnular) {
      btnCerrarModalAnular.addEventListener('click', cerrarModalAnularReserva);
    }

    const btnConfirmarAnular = document.getElementById('btn-confirmar-anular-reserva');
    if (btnConfirmarAnular) {
      btnConfirmarAnular.addEventListener('click', async () => {
        if (!reservaParaAnular) return;
        btnConfirmarAnular.classList.add('loading');
        btnConfirmarAnular.disabled = true;

        try {
          const res = await window.pedirApi(`/api/reservas/${reservaParaAnular.id}/anular`, {
            method: 'POST',
            body: JSON.stringify({})
          });
          cerrarModalAnularReserva();
          window.mostrarToast(res.mensaje || 'Reserva anulada y reembolsada.');
          await cargarMisReservas();
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btnConfirmarAnular.classList.remove('loading');
          btnConfirmarAnular.disabled = false;
        }
      });
    }

    // 9. Aviso "RESERVADO" en el flujo normal de ingreso (UPAO-8)
    const inputPlacaIngreso = document.getElementById('input-placa');
    const avisoReserva = document.getElementById('aviso-reserva-ingreso');
    const btnConfirmarReservaIngreso = document.getElementById('btn-confirmar-reserva-ingreso');
    const btnSubmitIngresoNormal = document.querySelector('#form-registrar-ingreso button[type="submit"]');
    let reservaDetectada = null;
    let temporizadorAviso = null;
    let ultimaPlacaConsultada = '';

    function ocultarAvisoReserva() {
      reservaDetectada = null;
      ultimaPlacaConsultada = '';
      if (avisoReserva) avisoReserva.classList.add('hidden');
      if (btnSubmitIngresoNormal) btnSubmitIngresoNormal.disabled = false;
    }

    async function consultarReservaPorPlaca() {
      if (!inputPlacaIngreso || !avisoReserva) return;
      const valor = inputPlacaIngreso.value.trim();
      const alfanumerico = valor.replace(/[^A-Za-z0-9]/g, '');
      if (alfanumerico.length < 6) {
        ocultarAvisoReserva();
        return;
      }
      if (valor === ultimaPlacaConsultada) return;
      ultimaPlacaConsultada = valor;

      try {
        const data = await window.pedirApi(`/api/reservas/por-placa/${encodeURIComponent(valor)}`);
        if (inputPlacaIngreso.value.trim() !== valor) return;
        if (!data.reserva) {
          reservaDetectada = null;
          avisoReserva.classList.add('hidden');
          if (btnSubmitIngresoNormal) btnSubmitIngresoNormal.disabled = false;
          return;
        }
        reservaDetectada = data.reserva;
        document.getElementById('aviso-reserva-codigo').textContent = data.reserva.codigo;
        const conductor = data.reserva.conductor ? data.reserva.conductor.nombre : '—';
        document.getElementById('aviso-reserva-detalle').textContent =
          `Conductor: ${conductor} · Adelanto pagado: ${formatearSoles(data.reserva.montoAdelanto)} · Vence: ${formatearFechaHora(data.reserva.fechaLimite)}`;
        avisoReserva.classList.remove('hidden');
        if (btnSubmitIngresoNormal) btnSubmitIngresoNormal.disabled = true;
      } catch (err) {
        avisoReserva.classList.add('hidden');
        if (btnSubmitIngresoNormal) btnSubmitIngresoNormal.disabled = false;
      }
    }

    if (inputPlacaIngreso) {
      inputPlacaIngreso.addEventListener('input', () => {
        clearTimeout(temporizadorAviso);
        temporizadorAviso = setTimeout(consultarReservaPorPlaca, 350);
      });
      inputPlacaIngreso.addEventListener('blur', consultarReservaPorPlaca);
    }

    const btnLimpiarIngresoForm = document.getElementById('btn-limpiar-ingreso');
    if (btnLimpiarIngresoForm) {
      btnLimpiarIngresoForm.addEventListener('click', ocultarAvisoReserva);
    }

    if (btnConfirmarReservaIngreso) {
      btnConfirmarReservaIngreso.addEventListener('click', async () => {
        if (!reservaDetectada) return;
        btnConfirmarReservaIngreso.classList.add('loading');
        btnConfirmarReservaIngreso.disabled = true;
        try {
          const res = await window.pedirApi(`/api/reservas/${reservaDetectada.id}/confirmar`, {
            method: 'POST',
            body: JSON.stringify({})
          });
          window.mostrarToast(res.mensaje || 'Reserva confirmada e ingreso registrado.');
          if (inputPlacaIngreso) inputPlacaIngreso.value = '';
          ocultarAvisoReserva();
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btnConfirmarReservaIngreso.classList.remove('loading');
          btnConfirmarReservaIngreso.disabled = false;
        }
      });
    }

    // 8. Botones de refresco y búsqueda en garita (UPAO-8 y UPAO-23)
    const btnRefrescarMisReservas = document.getElementById('btn-refrescar-mis-reservas');
    if (btnRefrescarMisReservas) {
      btnRefrescarMisReservas.addEventListener('click', cargarMisReservas);
    }

    const btnRefrescarHistorial = document.getElementById('btn-refrescar-historial-conductor');
    if (btnRefrescarHistorial) {
      btnRefrescarHistorial.addEventListener('click', cargarHistorialConductor);
    }

    const formBuscarGarita = document.getElementById('form-buscar-reservas-garita');
    if (formBuscarGarita) {
      formBuscarGarita.addEventListener('submit', (e) => {
        e.preventDefault();
        cargarGaritaReservas();
      });
    }

    const btnLimpiarGarita = document.getElementById('btn-limpiar-busqueda-garita');
    if (btnLimpiarGarita) {
      btnLimpiarGarita.addEventListener('click', () => {
        const inputQ = document.getElementById('input-buscar-reserva-garita');
        const selectEstado = document.getElementById('select-estado-reserva-garita');
        if (inputQ) inputQ.value = '';
        if (selectEstado) selectEstado.value = 'TODOS';
        cargarGaritaReservas();
      });
    }
  });

  window.reservasModulo = {
    cargarVistaConductor,
    cargarHistorialConductor,
    cargarGaritaReservas
  };
})();
