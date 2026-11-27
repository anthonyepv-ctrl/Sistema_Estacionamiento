(function () {
  let configPasarela = null;
  let preparacionActual = null;
  let vehiculosConductor = [];
  let reservaParaAnular = null;

  function formatearFechaHora(iso) {
    if (typeof window.formatearFechaHoraPeru === 'function') {
      return window.formatearFechaHoraPeru(iso);
    }
    if (!iso) return '—';
    const f = new Date(iso);
    if (Number.isNaN(f.getTime())) return '—';
    return f.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).replace(',', '');
  }

  function formatearFechaCorta(iso) {
    if (typeof window.formatearFechaCortaPeru === 'function') {
      return window.formatearFechaCortaPeru(iso);
    }
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(d);
    const val = (tipo) => partes.find((p) => p.type === tipo)?.value || '00';
    return `${val('day')}/${val('month')} ${val('hour')}:${val('minute')}`;
  }

  function formatearSoles(monto) {
    return `S/ ${Number(monto || 0).toFixed(2)}`;
  }

  function escaparHtml(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizarPlacaInput(valor) {
    if (typeof window.normalizarPlacaMtc === 'function') {
      return window.normalizarPlacaMtc(valor);
    }
    const limpio = String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpio.length === 0) return '';
    let corte = 3;
    if (limpio.length >= 7) corte = 3;
    else if (/^\d/.test(limpio)) corte = 4;
    else if (limpio.length === 6 && /\d{4}$/.test(limpio)) corte = 2;
    if (limpio.length <= corte) return limpio;
    const maxLen = limpio.length >= 7 ? 7 : 6;
    return `${limpio.slice(0, corte)}-${limpio.slice(corte, maxLen)}`;
  }

  function badgeEstadoReserva(estado) {
    const est = String(estado || '').toUpperCase();
    if (est === 'VIGENTE') {
      return '<span class="badge badge-success mono vigente">VIGENTE</span>';
    }
    if (est === 'UTILIZADA') {
      return '<span class="badge badge-primary mono utilizada">UTILIZADA</span>';
    }
    if (est === 'ANULADA') {
      return '<span class="badge badge-danger mono anulada">ANULADA</span>';
    }
    if (est === 'VENCIDA') {
      return '<span class="badge badge-warning mono vencida">VENCIDA</span>';
    }
    return `<span class="badge mono">${estado || '—'}</span>`;
  }

  function actualizarResumenPasarelaDueno(estado) {
    const badge = document.getElementById('badge-estado-pasarela');
    const txtOrigen = document.getElementById('texto-origen-pasarela');
    const txtPk = document.getElementById('texto-pk-pasarela');
    const txtSk = document.getElementById('texto-sk-pasarela');
    const inputPk = document.getElementById('input-pasarela-pk');

    if (badge) {
      if (!estado || !estado.habilitado) {
        badge.className = 'badge badge-danger mono';
        badge.textContent = 'SIN CONFIGURAR';
      } else if (estado.modo === 'PRODUCCION') {
        badge.className = 'badge badge-success mono';
        badge.textContent = 'ACTIVA · PRODUCCIÓN';
      } else {
        badge.className = 'badge badge-warning mono';
        badge.textContent = 'ACTIVA · MODO PRUEBA';
      }
    }

    if (txtOrigen) {
      const mapaOrigen = {
        panel_dueno: 'Panel del Dueño (personalizada en la web)',
        servidor_env: 'Variables del servidor (por defecto)',
        sin_configurar: 'Sin configurar'
      };
      txtOrigen.textContent = `Origen: ${mapaOrigen[estado && estado.origen] || '—'}`;
    }

    if (txtPk) {
      const pk = estado && estado.publishableKey ? estado.publishableKey : null;
      txtPk.textContent = `Clave Pública: ${pk ? `${pk.slice(0, 18)}...` : '—'}`;
    }

    if (txtSk) {
      txtSk.textContent = `Clave Secreta: ${(estado && estado.secretKeyMasked) || '—'}`;
    }

    if (inputPk && estado && estado.publishableKey && !inputPk.value) {
      inputPk.value = estado.publishableKey;
    }
  }

  async function cargarVistaPasarelaDueno() {
    try {
      const estado = await window.pedirApi('/api/reservas/config-pasarela');
      configPasarela = estado;
      actualizarResumenPasarelaDueno(estado);
    } catch (err) {
      window.mostrarToast(err.message, true);
    }
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
          tbody.innerHTML = vehiculosConductor.map((v) => {
            const placaEsc = escaparHtml(v.placa);
            const tipoEsc = escaparHtml(v.tipo);
            return `
            <tr>
              <td class="mono" style="font-weight:700;">${placaEsc}</td>
              <td>${tipoEsc}</td>
              <td class="text-right">
                <button type="button" class="btn btn-secondary btn-sm btn-eliminar-vehiculo" data-id="${Number(v.id)}" data-placa="${placaEsc}">
                  Eliminar
                </button>
              </td>
            </tr>
          `;
          }).join('');

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
          vehiculosConductor.map((v) => `<option value="${Number(v.id)}" data-tipo="${escaparHtml(v.tipoCodigo)}">${escaparHtml(v.placa)} — ${escaparHtml(v.tipo)}</option>`).join('');

        if (window.tipoReservaPreseleccionado) {
          const candidato = vehiculosConductor.find((v) => v.tipoCodigo === window.tipoReservaPreseleccionado);
          if (candidato) {
            selectReserva.value = String(candidato.id);
          } else {
            const selectTipoNuevo = document.getElementById('vehiculo-tipo');
            if (selectTipoNuevo) selectTipoNuevo.value = window.tipoReservaPreseleccionado;
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
        tbody.innerHTML = `<tr><td colspan="3" class="caption" style="text-align:center;color:#EF4444;">${escaparHtml(err.message)}</td></tr>`;
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
    const contenedorCards = document.getElementById('contenedor-tarjetas-reservas');
    if (!tbody && !contenedorCards) return;

    try {
      const data = await window.pedirApi('/api/reservas/mias');
      const reservas = data.reservas || [];

      if (reservas.length === 0) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="8" class="caption" style="text-align:center;">No registra reservas hasta el momento.</td></tr>';
        }
        if (contenedorCards) {
          contenedorCards.innerHTML = '<p class="caption" style="text-align:center;grid-column:1/-1;">No registra reservas hasta el momento.</p>';
        }
        return;
      }

      // 1. Renderizar Tarjetas de Reserva (§7.1 del Análisis y Diseño)
      if (contenedorCards) {
        contenedorCards.innerHTML = reservas.map((r) => {
          const puedeAnular = r.estado === 'VIGENTE';
          const codigoEsc = escaparHtml(r.codigo);
          const placaEsc = escaparHtml(r.placa);
          const tipoEsc = escaparHtml(r.tipo || 'Automóvil');
          return `
            <div class="card reserva-card" data-id="${Number(r.id)}">
              <h4>
                <span>Reserva #${Number(r.id)}</span>
                <span class="mono" style="font-size:0.85rem;color:var(--text2);">${codigoEsc}</span>
              </h4>
              <p><strong>Placa:</strong> <span class="mono" style="font-weight:700;">${placaEsc}</span></p>
              <p><strong>Tipo:</strong> ${tipoEsc}</p>
              <p><strong>Periodo:</strong> <span class="mono" style="font-size:0.82rem;">${formatearFechaHora(r.fechaReserva)} → ${formatearFechaHora(r.fechaLimite)}</span></p>
              <p><strong>Estado:</strong> ${badgeEstadoReserva(r.estado)}</p>
              <div class="reserva-monto-tag">
                <span class="caption">Monto Adelanto:</span>
                <span class="mono" style="font-size:1.05rem;color:var(--primary);font-weight:700;">${formatearSoles(r.montoAdelanto)}</span>
              </div>
              ${puedeAnular ? `
                <button type="button" class="btn-anular btn btn-danger btn-abrir-anular-reserva"
                  data-id="${Number(r.id)}"
                  data-codigo="${codigoEsc}"
                  data-placa="${placaEsc}"
                  data-tipo="${tipoEsc}"
                  data-monto="${Number(r.montoAdelanto)}">
                  Anular reserva
                </button>
              ` : ''}
            </div>
          `;
        }).join('');
      }

      // 2. Renderizar Tabla de Mis Reservas
      if (tbody) {
        tbody.innerHTML = reservas.map((r) => {
          const puedeAnular = r.estado === 'VIGENTE';
          const codigoEsc = escaparHtml(r.codigo);
          const placaEsc = escaparHtml(r.placa);
          const tipoEsc = escaparHtml(r.tipo || 'Automóvil');
          return `
            <tr>
              <td class="mono" style="font-weight:700;">${codigoEsc}</td>
              <td class="mono" style="font-weight:700;">${placaEsc}</td>
              <td>${tipoEsc}</td>
              <td class="mono">${formatearFechaHora(r.fechaReserva)}</td>
              <td class="mono">${formatearFechaHora(r.fechaLimite)}</td>
              <td class="text-right mono" style="font-weight:600;">${formatearSoles(r.montoAdelanto)}</td>
              <td>${badgeEstadoReserva(r.estado)}</td>
              <td class="text-right">
                ${puedeAnular ? `
                  <button type="button" class="btn btn-danger btn-sm btn-anular btn-abrir-anular-reserva"
                    title="Anular reserva"
                    data-id="${Number(r.id)}"
                    data-codigo="${codigoEsc}"
                    data-placa="${placaEsc}"
                    data-tipo="${tipoEsc}"
                    data-monto="${Number(r.montoAdelanto)}">
                    Anular
                  </button>
                ` : '<span class="caption">—</span>'}
              </td>
            </tr>
          `;
        }).join('');
      }

      // 3. Vincular botones de Anulación
      document.querySelectorAll('.btn-abrir-anular-reserva').forEach((btn) => {
        btn.addEventListener('click', () => {
          abrirModalAnularReserva({
            id: Number(btn.getAttribute('data-id')),
            codigo: btn.getAttribute('data-codigo'),
            placa: btn.getAttribute('data-placa'),
            tipo: btn.getAttribute('data-tipo') || 'Automóvil',
            montoAdelanto: Number(btn.getAttribute('data-monto'))
          });
        });
      });
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="caption" style="text-align:center;color:#EF4444;">${escaparHtml(err.message)}</td></tr>`;
      }
      if (contenedorCards) {
        contenedorCards.innerHTML = `<p class="caption" style="text-align:center;color:#EF4444;grid-column:1/-1;">${escaparHtml(err.message)}</p>`;
      }
    }
  }

  function abrirModalAnularReserva(reserva) {
    reservaParaAnular = reserva;
    const modal = document.getElementById('modal-anular') || document.getElementById('modal-anular-reserva');
    const elCodigo = document.getElementById('modal-anular-codigo');
    const elPlaca = document.getElementById('modal-anular-placa');
    const elTipo = document.getElementById('modal-anular-tipo');
    const elMonto = document.getElementById('modal-anular-monto');

    if (elCodigo) elCodigo.textContent = reserva.codigo;
    if (elPlaca) elPlaca.textContent = reserva.placa;
    if (elTipo) elTipo.textContent = reserva.tipo || 'Automóvil';
    if (elMonto) elMonto.textContent = formatearSoles(reserva.montoAdelanto);
    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function cerrarModalAnularReserva() {
    reservaParaAnular = null;
    const modal = document.getElementById('modal-anular') || document.getElementById('modal-anular-reserva');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  async function cargarVistaConductor() {
    ocultarCheckoutPasarela();
    await Promise.all([
      cargarVehiculosConductor(),
      cargarMisReservas()
    ]);
  }

  function ocultarCheckoutPasarela() {
    preparacionActual = null;
    if (window.PasarelaPago && typeof window.PasarelaPago.cancelarSiPendiente === 'function') {
      window.PasarelaPago.cancelarSiPendiente();
    }
    const modalPago = document.getElementById('modal-pago-reserva');
    const errDiv = document.getElementById('pasarela-pago-errors');
    const avisoMin = document.getElementById('modal-pago-minimo-aviso');
    const btnConfirmar = document.getElementById('btn-confirmar-pago-reserva');
    if (modalPago) modalPago.classList.add('hidden');
    if (errDiv) errDiv.textContent = '';
    if (avisoMin) avisoMin.classList.add('hidden');
    if (btnConfirmar) {
      btnConfirmar.classList.remove('loading');
      btnConfirmar.disabled = false;
    }
  }

  async function cargarHistorialConductor() {
    const tbody = document.getElementById('tbody-historial-conductor');
    const selectEstado = document.getElementById('select-estado-historial-conductor');
    if (!tbody) return;

    const estado = selectEstado ? selectEstado.value : 'TODOS';
    const params = new URLSearchParams();
    if (estado && estado !== 'TODOS') params.set('estado', estado);
    const qs = params.toString();

    try {
      const data = await window.pedirApi(`/api/conductor/historial${qs ? `?${qs}` : ''}`);
      const estadias = data.estadias || [];

      if (estadias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="caption" style="text-align:center;">Aún no registra estadías con ese criterio.</td></tr>';
        return;
      }

      const formatearCorta = formatearFechaCorta;

      tbody.innerHTML = estadias.map((e) => {
        const badge = e.estado === 'En cochera'
          ? '<span class="badge badge-success mono">EN COCHERA</span>'
          : '<span class="badge mono" style="background:#E2E8F0;color:#334155;">FINALIZADA</span>';
        const placaEsc = escaparHtml(e.placa);
        const tipoTexto = e.tipo && e.tipo.toLowerCase().includes('moto')
          ? 'Moto'
          : (e.tipo && e.tipo.toLowerCase().includes('auto') ? 'Auto' : (e.tipo || '—'));
        const tipoEsc = escaparHtml(tipoTexto);
        const codigoEsc = e.codigoReserva ? escaparHtml(e.codigoReserva) : '—';

        return `
          <tr>
            <td class="mono" style="font-weight:700;">${placaEsc}</td>
            <td>${tipoEsc}</td>
            <td class="mono">${formatearCorta(e.horaIngreso)}</td>
            <td class="mono">${e.horaSalida ? formatearCorta(e.horaSalida) : 'En cochera'}</td>
            <td class="mono">${codigoEsc}</td>
            <td class="text-right mono">${e.montoAdelanto > 0 ? formatearSoles(e.montoAdelanto) : 'S/ 0.00'}</td>
            <td class="text-right mono">${e.montoPagado !== null ? formatearSoles(e.montoPagado) : 'Pendiente'}</td>
            <td>${badge}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="caption" style="text-align:center;color:#EF4444;">${escaparHtml(err.message)}</td></tr>`;
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
          ? 'Sin resultados'
          : `${reservas.length} reserva(s)`;
      }

      if (reservas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="caption" style="text-align:center;">No se encontraron reservas.</td></tr>';
        return;
      }

      const formatearCorta = formatearFechaCorta;

      tbody.innerHTML = reservas.map((r) => {
        const puedeConfirmar = r.estado === 'VIGENTE';
        const nombreCond = escaparHtml(r.conductor ? r.conductor.nombre : '—');
        const dniCond = escaparHtml(r.conductor && r.conductor.dni ? r.conductor.dni : '—');
        const codigoEsc = escaparHtml(r.codigo);
        const placaEsc = escaparHtml(r.placa);
        const tipoTexto = r.tipo && r.tipo.toLowerCase().includes('moto')
          ? 'Moto'
          : (r.tipo && r.tipo.toLowerCase().includes('auto') ? 'Auto' : (r.tipo || '—'));
        const tipoEsc = escaparHtml(tipoTexto);
        return `
          <tr>
            <td class="mono" style="font-weight:700;">${codigoEsc}</td>
            <td class="mono" style="font-weight:700;">${placaEsc}</td>
            <td>${tipoEsc}</td>
            <td class="celda-conductor" title="${nombreCond} (${dniCond})">${nombreCond} <span class="caption mono">(${dniCond})</span></td>
            <td class="mono">${formatearCorta(r.fechaReserva)}</td>
            <td class="mono">${formatearCorta(r.fechaLimite)}</td>
            <td class="text-right mono">${formatearSoles(r.montoAdelanto)}</td>
            <td>${badgeEstadoReserva(r.estado)}</td>
            <td class="text-right">
              ${puedeConfirmar ? `
                <button type="button" class="btn btn-primary btn-sm btn-confirmar-reserva-garita"
                  data-id="${Number(r.id)}"
                  data-codigo="${codigoEsc}"
                  data-placa="${placaEsc}">
                  Confirmar
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
      tbody.innerHTML = `<tr><td colspan="9" class="caption" style="text-align:center;color:#EF4444;">${escaparHtml(err.message)}</td></tr>`;
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
        const correo = document.getElementById('reg-correo') ? document.getElementById('reg-correo').value.trim() : '';
        const usuario = document.getElementById('reg-usuario').value.trim();
        const contrasena = document.getElementById('reg-password').value;
        const aceptoTerminosEl = document.getElementById('reg-acepto-terminos');
        const btnSubmit = document.getElementById('btn-registro-conductor-submit');

        if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
          window.mostrarToast('Ingrese un correo electrónico válido.', true);
          return;
        }
        if (aceptoTerminosEl && !aceptoTerminosEl.checked) {
          window.mostrarToast('Debe aceptar los Términos y Condiciones y la Política de Privacidad.', true);
          return;
        }

        btnSubmit.classList.add('loading');
        btnSubmit.disabled = true;

        try {
          const sesion = await window.pedirApi('/api/auth/registro-conductor', {
            method: 'POST',
            body: JSON.stringify({
              nombre,
              dni,
              celular,
              correo,
              usuario,
              contrasena,
              aceptoTerminos: true
            })
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
    const selectTipoVehiculo = document.getElementById('vehiculo-tipo');
    if (inputPlacaVehiculo) {
      inputPlacaVehiculo.addEventListener('input', () => {
        inputPlacaVehiculo.value = normalizarPlacaInput(inputPlacaVehiculo.value);
        if (selectTipoVehiculo && typeof window.inferirTipoPlacaMtc === 'function') {
          const tipoInferido = window.inferirTipoPlacaMtc(inputPlacaVehiculo.value);
          if (tipoInferido) {
            selectTipoVehiculo.value = tipoInferido;
          }
        }
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

    // 5. Preparar resumen de pago Culqi (UPAO-21)
    const selectVehiculoReserva = document.getElementById('reserva-vehiculo-select');
    if (selectVehiculoReserva) {
      selectVehiculoReserva.addEventListener('change', () => {
        ocultarCheckoutPasarela();
        actualizarVistaPreviaAdelanto();
      });
    }

    const btnIrARegistrarVehiculo = document.getElementById('btn-ir-a-registrar-vehiculo');
    if (btnIrARegistrarVehiculo) {
      btnIrARegistrarVehiculo.addEventListener('click', () => {
        const cardVeh = document.getElementById('card-mis-vehiculos');
        const inputPlaca = document.getElementById('vehiculo-placa');
        if (cardVeh) cardVeh.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (inputPlaca) setTimeout(() => inputPlaca.focus(), 250);
      });
    }

    const btnPrepararPago = document.getElementById('btn-preparar-pago');
    if (btnPrepararPago) {
      btnPrepararPago.addEventListener('click', async () => {
        const selectVehiculo = document.getElementById('reserva-vehiculo-select');
        const idVehiculo = selectVehiculo ? Number(selectVehiculo.value) : 0;

        if (!idVehiculo) {
          if (vehiculosConductor.length === 0) {
            window.mostrarToast('Primero registra tu placa en "2. Mis Vehículos" para poder reservar.', true);
            const cardVeh = document.getElementById('card-mis-vehiculos');
            const inputPlaca = document.getElementById('vehiculo-placa');
            if (cardVeh) cardVeh.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (inputPlaca) setTimeout(() => inputPlaca.focus(), 250);
            return;
          }
          window.mostrarToast('Seleccione primero uno de sus vehículos registrados.', true);
          return;
        }

        btnPrepararPago.classList.add('loading');
        btnPrepararPago.disabled = true;

        try {
          preparacionActual = await window.pedirApi('/api/reservas/preparar-pago', {
            method: 'POST',
            body: JSON.stringify({ idVehiculo })
          });

          const elMonto = document.getElementById('reserva-monto-adelanto');
          if (elMonto) elMonto.textContent = formatearSoles(preparacionActual.montoAdelanto);

          const modalPagoVeh = document.getElementById('modal-pago-vehiculo');
          const modalPagoMonto = document.getElementById('modal-pago-monto');
          const modalPagoMetodos = document.getElementById('modal-pago-metodos');
          const avisoMin = document.getElementById('modal-pago-minimo-aviso');
          const errDiv = document.getElementById('pasarela-pago-errors');
          const vehSel = vehiculosConductor.find((v) => v.id === idVehiculo);

          if (modalPagoVeh) modalPagoVeh.textContent = vehSel ? `${vehSel.placa} (${vehSel.tipo})` : 'Vehículo seleccionado';
          if (modalPagoMonto) modalPagoMonto.textContent = formatearSoles(preparacionActual.montoAdelanto);
          if (modalPagoMetodos) {
            modalPagoMetodos.textContent = preparacionActual.yapeHabilitado
              ? 'Tarjetas de crédito o débito (Visa, Mastercard, Amex, Diners) y Yape.'
              : `Tarjetas de crédito o débito (Visa, Mastercard, Amex, Diners). Yape habilitado desde ${formatearSoles(preparacionActual.yapeMinimoSoles || 6)}.`;
          }
          if (avisoMin) {
            avisoMin.classList.toggle('hidden', !preparacionActual.montoMinimoAplicado);
          }
          if (errDiv) errDiv.textContent = '';

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

    const btnCancelarCheckout = document.getElementById('btn-cancelar-checkout');
    if (btnCancelarCheckout) {
      btnCancelarCheckout.addEventListener('click', () => {
        ocultarCheckoutPasarela();
      });
    }

    // 6. Tokenizar en Culqi Checkout v4 y crear Reserva atómica (UPAO-21)
    const formCrearReserva = document.getElementById('form-crear-reserva');
    if (formCrearReserva) {
      formCrearReserva.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!preparacionActual || !window.PasarelaPago) {
          window.mostrarToast('Primero prepare el pago de la reserva.', true);
          return;
        }

        const btnConfirmar = document.getElementById('btn-confirmar-pago-reserva');
        const btnCancelar = document.getElementById('btn-cancelar-checkout');
        const errDiv = document.getElementById('pasarela-pago-errors');
        if (errDiv) errDiv.textContent = '';

        const placaSolicitada = preparacionActual.placa;

        try {
          const tokenRes = await window.PasarelaPago.iniciarPago({
            proveedor: preparacionActual.proveedor,
            publishableKey: preparacionActual.publishableKey,
            montoCentimos: preparacionActual.montoCentimos,
            titulo: `Reserva ${preparacionActual.placa}`,
            yapeHabilitado: preparacionActual.yapeHabilitado
          });

          btnConfirmar.classList.add('loading');
          btnConfirmar.disabled = true;
          if (btnCancelar) btnCancelar.disabled = true;

          const selectVehiculo = document.getElementById('reserva-vehiculo-select');
          const idVehiculo = Number(selectVehiculo.value);
          const idempotencyKey = window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `res-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

          let respuestaReserva = null;
          try {
            respuestaReserva = await window.pedirApi('/api/reservas', {
              method: 'POST',
              timeoutMs: 25000,
              body: JSON.stringify({
                idVehiculo,
                sourceToken: tokenRes.sourceToken,
                email: tokenRes.email || '',
                idempotencyKey
              })
            });
          } catch (postErr) {
            if (postErr && (postErr.esTimeout || postErr.esErrorRed)) {
              const chequeo = await window.pedirApi('/api/reservas/mias', { timeoutMs: 12000 }).catch(() => null);
              const yaCreada = chequeo && Array.isArray(chequeo.reservas)
                ? chequeo.reservas.find((r) => r.estado === 'VIGENTE' && r.placa === placaSolicitada)
                : null;
              if (yaCreada) {
                respuestaReserva = {
                  reserva: yaCreada,
                  mensaje: `Reserva ${yaCreada.codigo} confirmada para ${yaCreada.placa}.`
                };
              } else {
                throw postErr;
              }
            } else {
              throw postErr;
            }
          }

          window.mostrarToast((respuestaReserva && respuestaReserva.mensaje) || 'Reserva creada exitosamente.');
          ocultarCheckoutPasarela();
          try {
            await cargarMisReservas();
          } catch (_) {}
        } catch (err) {
          if (err && err.cancelado) return;
          if (errDiv) errDiv.textContent = err.message;
          window.mostrarToast(err.message, true);
        } finally {
          btnConfirmar.classList.remove('loading');
          btnConfirmar.disabled = false;
          if (btnCancelar) btnCancelar.disabled = false;
        }
      });
    }

    // 7. Modal de Anulación de Reserva (UPAO-22 - Sección 7.2 y 7.3)
    const btnsCerrarModal = [
      document.getElementById('btn-cancelar-anular'),
      document.getElementById('btn-cerrar-modal-anular')
    ].filter(Boolean);

    btnsCerrarModal.forEach((btn) => {
      btn.addEventListener('click', cerrarModalAnularReserva);
    });

    const btnsConfirmarAnular = [
      document.getElementById('btn-confirmar-anular'),
      document.getElementById('btn-confirmar-anular-reserva')
    ].filter(Boolean);

    btnsConfirmarAnular.forEach((btnConfirmar) => {
      btnConfirmar.addEventListener('click', async () => {
        if (!reservaParaAnular) return;
        const reservaObjetivo = { ...reservaParaAnular };
        btnConfirmar.classList.add('loading');
        btnConfirmar.disabled = true;
        btnsCerrarModal.forEach((b) => { b.disabled = true; });

        const refrescarTrasAnulacion = async () => {
          try {
            await cargarMisReservas();
          } catch (_) {}
          if (window.disponibilidadModulo && typeof window.disponibilidadModulo.recargar === 'function') {
            window.disponibilidadModulo.recargar();
          }
        };

        try {
          let res = null;
          try {
            res = await window.pedirApi(`/api/reservas/${reservaObjetivo.id}`, {
              method: 'DELETE',
              timeoutMs: 25000
            });
          } catch (delErr) {
            if (delErr && (delErr.esTimeout || delErr.esErrorRed)) {
              const chequeo = await window.pedirApi('/api/reservas/mias', { timeoutMs: 12000 }).catch(() => null);
              const encontrada = chequeo && Array.isArray(chequeo.reservas)
                ? chequeo.reservas.find((r) => Number(r.id) === Number(reservaObjetivo.id))
                : null;
              if (encontrada && encontrada.estado === 'ANULADA') {
                res = {
                  reserva: encontrada,
                  mensaje: encontrada.pasarelaReembolsoId
                    ? 'Reserva anulada y reembolso procesado'
                    : 'Reserva anulada correctamente'
                };
              } else if (encontrada && encontrada.estado !== 'VIGENTE') {
                cerrarModalAnularReserva();
                window.mostrarToast(`La reserva ya cambió a estado ${encontrada.estado}.`, true);
                await refrescarTrasAnulacion();
                return;
              } else {
                throw delErr;
              }
            } else {
              throw delErr;
            }
          }

          cerrarModalAnularReserva();
          window.mostrarToast((res && res.mensaje) || 'Reserva anulada y reembolso procesado');
          await refrescarTrasAnulacion();
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btnConfirmar.classList.remove('loading');
          btnConfirmar.disabled = false;
          btnsCerrarModal.forEach((b) => { b.disabled = false; });
        }
      });
    });

    // 9. Aviso "RESERVADO" y botón unificado en el flujo normal de ingreso (UPAO-8)
    const inputPlacaIngreso = document.getElementById('input-placa');
    const avisoReserva = document.getElementById('aviso-reserva-ingreso');
    const btnSubmitIngresoNormal = document.getElementById('btn-registrar-ingreso')
      || document.querySelector('#form-registrar-ingreso button[type="submit"]');
    let reservaDetectada = null;
    let temporizadorAviso = null;
    let ultimaPlacaConsultada = '';

    function aplicarModoBotonIngreso(conReserva) {
      if (!btnSubmitIngresoNormal) return;
      if (conReserva) {
        btnSubmitIngresoNormal.classList.remove('btn-success');
        btnSubmitIngresoNormal.classList.add('btn-primary');
        btnSubmitIngresoNormal.textContent = 'Confirmar ingreso con reserva';
        btnSubmitIngresoNormal.disabled = false;
      } else {
        btnSubmitIngresoNormal.classList.remove('btn-primary');
        btnSubmitIngresoNormal.classList.add('btn-success');
        btnSubmitIngresoNormal.textContent = 'Registrar Ingreso';
        btnSubmitIngresoNormal.disabled = false;
      }
    }

    function ocultarAvisoReserva() {
      reservaDetectada = null;
      ultimaPlacaConsultada = '';
      if (avisoReserva) avisoReserva.classList.add('hidden');
      aplicarModoBotonIngreso(false);
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
          aplicarModoBotonIngreso(false);
          return;
        }
        reservaDetectada = data.reserva;
        document.getElementById('aviso-reserva-codigo').textContent = data.reserva.codigo;
        const conductor = data.reserva.conductor ? data.reserva.conductor.nombre : '—';
        document.getElementById('aviso-reserva-detalle').textContent =
          `${conductor} · Adelanto: ${formatearSoles(data.reserva.montoAdelanto)} · Vence: ${formatearFechaHora(data.reserva.fechaLimite)}`;
        avisoReserva.classList.remove('hidden');
        aplicarModoBotonIngreso(true);
      } catch (err) {
        reservaDetectada = null;
        avisoReserva.classList.add('hidden');
        aplicarModoBotonIngreso(false);
      }
    }

    if (inputPlacaIngreso) {
      inputPlacaIngreso.addEventListener('input', () => {
        if (reservaDetectada && inputPlacaIngreso.value.trim() !== ultimaPlacaConsultada) {
          reservaDetectada = null;
          if (avisoReserva) avisoReserva.classList.add('hidden');
          aplicarModoBotonIngreso(false);
        }
        clearTimeout(temporizadorAviso);
        temporizadorAviso = setTimeout(consultarReservaPorPlaca, 300);
      });
      inputPlacaIngreso.addEventListener('blur', consultarReservaPorPlaca);
    }

    const btnLimpiarIngresoForm = document.getElementById('btn-limpiar-ingreso');
    if (btnLimpiarIngresoForm) {
      btnLimpiarIngresoForm.addEventListener('click', ocultarAvisoReserva);
    }

    window.reservasModulo.obtenerReservaDetectadaIngreso = () => reservaDetectada;
    window.reservasModulo.limpiarReservaDetectadaIngreso = ocultarAvisoReserva;

    // 8. Botones de refresco y búsqueda en garita (UPAO-8 y UPAO-23)
    const btnRefrescarMisReservas = document.getElementById('btn-refrescar-mis-reservas');
    if (btnRefrescarMisReservas) {
      btnRefrescarMisReservas.addEventListener('click', cargarMisReservas);
    }

    const btnRefrescarHistorial = document.getElementById('btn-refrescar-historial-conductor');
    if (btnRefrescarHistorial) {
      btnRefrescarHistorial.addEventListener('click', cargarHistorialConductor);
    }

    const selectEstadoHistorial = document.getElementById('select-estado-historial-conductor');
    if (selectEstadoHistorial) {
      selectEstadoHistorial.addEventListener('change', cargarHistorialConductor);
    }

    const formBuscarGarita = document.getElementById('form-buscar-reservas-garita');
    if (formBuscarGarita) {
      formBuscarGarita.addEventListener('submit', (e) => {
        e.preventDefault();
        cargarGaritaReservas();
      });
    }

    const selectEstadoGarita = document.getElementById('select-estado-reserva-garita');
    if (selectEstadoGarita) {
      selectEstadoGarita.addEventListener('change', cargarGaritaReservas);
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

    // 10. Configuración de Pasarela de Pagos Culqi Perú para el Dueño (UPAO-21)
    const cardPasarela = document.getElementById('card-modulo-pasarela');
    if (cardPasarela) {
      cardPasarela.addEventListener('click', () => window.mostrarPantalla('pasarela-pagos'));
    }

    const btnVolverMenuPasarela = document.getElementById('btn-volver-menu-desde-pasarela');
    if (btnVolverMenuPasarela) {
      btnVolverMenuPasarela.addEventListener('click', () => window.mostrarPantalla('dashboard'));
    }

    const formConfigPasarela = document.getElementById('form-config-pasarela-dueno');
    if (formConfigPasarela) {
      formConfigPasarela.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pk = document.getElementById('input-pasarela-pk').value.trim();
        const sk = document.getElementById('input-pasarela-sk').value.trim();
        const btnGuardar = document.getElementById('btn-guardar-pasarela');

        btnGuardar.classList.add('loading');
        btnGuardar.disabled = true;

        try {
          const res = await window.pedirApi('/api/reservas/config-pasarela', {
            method: 'PUT',
            body: JSON.stringify({ publishableKey: pk, secretKey: sk })
          });
          configPasarela = res;
          actualizarResumenPasarelaDueno(res);
          document.getElementById('input-pasarela-sk').value = '';
          window.mostrarToast(res.mensaje || 'Credenciales de pasarela actualizadas.');
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btnGuardar.classList.remove('loading');
          btnGuardar.disabled = false;
        }
      });
    }

    const btnRestaurarPasarela = document.getElementById('btn-restaurar-pasarela');
    if (btnRestaurarPasarela) {
      btnRestaurarPasarela.addEventListener('click', async () => {
        btnRestaurarPasarela.classList.add('loading');
        btnRestaurarPasarela.disabled = true;
        try {
          const res = await window.pedirApi('/api/reservas/config-pasarela', {
            method: 'PUT',
            body: JSON.stringify({ restaurarPorDefecto: true })
          });
          configPasarela = res;
          document.getElementById('input-pasarela-pk').value = res.publishableKey || '';
          document.getElementById('input-pasarela-sk').value = '';
          actualizarResumenPasarelaDueno(res);
          window.mostrarToast(res.mensaje || 'Claves restauradas.');
        } catch (err) {
          window.mostrarToast(err.message, true);
        } finally {
          btnRestaurarPasarela.classList.remove('loading');
          btnRestaurarPasarela.disabled = false;
        }
      });
    }
  });

  window.reservasModulo = {
    cargarVistaConductor,
    cargarHistorialConductor,
    cargarGaritaReservas,
    cargarVistaPasarelaDueno
  };
})();
