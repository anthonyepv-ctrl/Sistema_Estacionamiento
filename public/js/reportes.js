/**
 * Módulo de Reporte de Ingresos Diarios (UPAO-17 / UPAO-53)
 * Prototipado interactivo de la vista de recaudación y desglose para el rol DUEÑO.
 */
document.addEventListener('DOMContentLoaded', () => {
  const cardModuloReportes = document.getElementById('card-modulo-reportes');
  const btnBackToMenu = document.getElementById('btn-back-to-menu-reportes');
  const viewReportes = document.getElementById('view-reportes');
  const viewDashboard = document.getElementById('view-dashboard');

  const inputFecha = document.getElementById('input-fecha-reporte');
  const btnConsultar = document.getElementById('btn-consultar-reporte');
  const errorFecha = document.getElementById('fecha-reporte-error');
  const labelFechaPeruana = document.getElementById('label-fecha-peruana');

  // Tarjetas de Métodos y Total General
  const totalEfectivoEl = document.getElementById('reporte-total-efectivo');
  const totalYapeEl = document.getElementById('reporte-total-yape');
  const totalGeneralEl = document.getElementById('reporte-total-general');
  const countEfectivoEl = document.getElementById('reporte-count-efectivo');
  const countYapeEl = document.getElementById('reporte-count-yape');

  // Barra de Desglose Proporcional
  const barFisico = document.getElementById('bar-fisico');
  const barDigital = document.getElementById('bar-digital');
  const lblPctFisico = document.getElementById('lbl-pct-fisico');
  const lblPctDigital = document.getElementById('lbl-pct-digital');

  // Tabla y estados
  const tablaBody = document.getElementById('tabla-reportes-body');
  const reporteVacio = document.getElementById('reporte-vacio');
  const tableContainer = tablaBody ? tablaBody.closest('.table-container') : null;

  // Pills y filtros interactivos
  const pillTodos = document.getElementById('pill-filtro-todos');
  const pillEfectivo = document.getElementById('pill-filtro-efectivo');
  const pillYape = document.getElementById('pill-filtro-yape');
  const pillPos = document.getElementById('pill-filtro-pos');
  const pillCulqi = document.getElementById('pill-filtro-culqi');
  const pillCountTodos = document.getElementById('pill-count-todos');
  const cardFiltroEfectivo = document.getElementById('card-filtro-efectivo');
  const cardFiltroYape = document.getElementById('card-filtro-yape');

  function obtenerToken() {
    if (typeof window.obtenerTokenSesion === 'function') {
      return window.obtenerTokenSesion();
    }
    try {
      const crudo = localStorage.getItem('cochera_sesion') || sessionStorage.getItem('cochera_sesion');
      if (!crudo) return null;
      const sesion = JSON.parse(crudo);
      return sesion && sesion.token ? sesion.token : null;
    } catch (e) {
      return null;
    }
  }

  // Estado interno en memoria
  let transaccionesActuales = [];
  let filtroMetodoActivo = 'todos';

  function obtenerFechaHoyISO() {
    if (typeof window.obtenerHoyPeruISO === 'function') {
      return window.obtenerHoyPeruISO();
    }
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const val = (tipo) => partes.find((p) => p.type === tipo)?.value || '01';
    return `${val('year')}-${val('month')}-${val('day')}`;
  }

  function formatearFechaPeruana(fechaISO) {
    if (!fechaISO) return '--/--/----';
    const partes = fechaISO.split('-');
    if (partes.length !== 3) return fechaISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  function formatearMoneda(valor) {
    const num = Number(valor) || 0;
    return `S/ ${num.toFixed(2)}`;
  }

  // Inicialización de límites de fecha
  function inicializarSelectorFecha() {
    if (!inputFecha) return;
    const hoyISO = obtenerFechaHoyISO();
    inputFecha.max = hoyISO;
    if (!inputFecha.value) {
      inputFecha.value = hoyISO;
    }
    if (labelFechaPeruana) {
      labelFechaPeruana.textContent = formatearFechaPeruana(inputFecha.value);
    }
  }

  // Navegación
  if (cardModuloReportes) {
    cardModuloReportes.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.mostrarPantalla === 'function') {
        window.mostrarPantalla('reportes');
      } else {
        document.querySelectorAll('.view-section').forEach(section => {
          section.classList.remove('active');
        });
        if (viewReportes) viewReportes.classList.add('active');
      }
      inicializarSelectorFecha();
      consultarRecaudacion(inputFecha.value);
    });
  }

  if (btnBackToMenu) {
    btnBackToMenu.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.mostrarPantalla === 'function') {
        window.mostrarPantalla('dashboard');
      } else {
        if (viewReportes) viewReportes.classList.remove('active');
        if (viewDashboard) viewDashboard.classList.add('active');
      }
    });
  }

  if (btnConsultar) {
    btnConsultar.addEventListener('click', () => {
      const fecha = inputFecha.value;
      if (!fecha) return;

      const hoyISO = obtenerFechaHoyISO();
      if (fecha > hoyISO) {
        if (errorFecha) errorFecha.style.display = 'block';
        return;
      }

      if (errorFecha) errorFecha.style.display = 'none';
      consultarRecaudacion(fecha);
    });
  }

  if (inputFecha) {
    inputFecha.addEventListener('change', () => {
      if (errorFecha) errorFecha.style.display = 'none';
      if (labelFechaPeruana) {
        labelFechaPeruana.textContent = formatearFechaPeruana(inputFecha.value);
      }
    });
  }

  // Consulta de recaudación
  async function consultarRecaudacion(fechaISO) {
    if (!fechaISO) return;

    if (labelFechaPeruana) {
      labelFechaPeruana.textContent = formatearFechaPeruana(fechaISO);
    }

    if (btnConsultar) {
      btnConsultar.disabled = true;
      btnConsultar.textContent = 'Consultando...';
    }

    try {
      const token = obtenerToken();
      const res = await fetch(`/api/reportes/diario?fecha=${encodeURIComponent(fechaISO)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo consultar la recaudación.');
      }

      const movimientos = Array.isArray(data.movimientos) ? data.movimientos : [];

      transaccionesActuales = movimientos;
      filtroMetodoActivo = 'todos';
      actualizarEstilosPills();
      actualizarTotales(transaccionesActuales);
      renderizarTabla(transaccionesActuales);

    } catch (err) {
      console.error('Error al consultar recaudación:', err);
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast(err.message || 'No se pudo cargar la recaudación.', true);
      }
      transaccionesActuales = [];
      actualizarTotales([]);
      renderizarTabla([]);
    } finally {
      if (btnConsultar) {
        btnConsultar.disabled = false;
        btnConsultar.textContent = 'Consultar';
      }
    }
  }

  function actualizarTotales(movimientos) {
    let totalEfectivo = 0;
    let totalYape = 0;
    let totalPos = 0;
    let totalCulqi = 0;
    let totalOtros = 0;
    let countEfectivo = 0;
    let countYape = 0;
    let countPos = 0;
    let countCulqi = 0;
    let countOtros = 0;

    movimientos.forEach(m => {
      const metodo = (m.metodoPago || '').toLowerCase();
      const monto = Number(m.monto) || 0;
      if (metodo.includes('efectivo')) {
        totalEfectivo += monto;
        countEfectivo++;
      } else if (metodo.includes('yape')) {
        totalYape += monto;
        countYape++;
      } else if (metodo.includes('pos') || metodo.includes('tarjeta')) {
        totalPos += monto;
        countPos++;
      } else if (metodo.includes('culqi')) {
        totalCulqi += monto;
        countCulqi++;
      } else {
        totalOtros += monto;
        countOtros++;
      }
    });

    const totalDigital = totalYape + totalPos + totalCulqi + totalOtros;
    const countDigital = countYape + countPos + countCulqi + countOtros;
    const totalGeneral = totalEfectivo + totalDigital;

    if (totalEfectivoEl) totalEfectivoEl.textContent = formatearMoneda(totalEfectivo);
    if (totalYapeEl) totalYapeEl.textContent = formatearMoneda(totalDigital);
    if (totalGeneralEl) totalGeneralEl.textContent = formatearMoneda(totalGeneral);

    if (countEfectivoEl) countEfectivoEl.textContent = `${countEfectivo} cobro${countEfectivo === 1 ? '' : 's'}`;
    if (countYapeEl) {
      const detalleDigital = [
        countYape > 0 ? `${countYape} Yape` : null,
        countPos > 0 ? `${countPos} POS` : null,
        countCulqi > 0 ? `${countCulqi} Culqi` : null
      ].filter(Boolean);
      countYapeEl.textContent = detalleDigital.length > 0
        ? detalleDigital.join(' · ')
        : `${countDigital} cobro${countDigital === 1 ? '' : 's'}`;
    }
    if (pillCountTodos) pillCountTodos.textContent = movimientos.length;

    // Actualizar barra de desglose porcentual
    if (barFisico && barDigital && lblPctFisico && lblPctDigital) {
      if (totalGeneral > 0) {
        const pctFisico = Math.round((totalEfectivo / totalGeneral) * 100);
        const pctDigital = 100 - pctFisico;

        barFisico.style.width = `${pctFisico}%`;
        barDigital.style.width = `${pctDigital}%`;

        lblPctFisico.textContent = `💵 ${pctFisico}% Físico (${formatearMoneda(totalEfectivo)})`;
        lblPctDigital.textContent = `📱 ${pctDigital}% Digital (${formatearMoneda(totalDigital)})`;
      } else {
        barFisico.style.width = '0%';
        barDigital.style.width = '0%';
        lblPctFisico.textContent = '💵 0% Físico';
        lblPctDigital.textContent = '📱 0% Digital';
      }
    }
  }

  function renderizarTabla(movimientos) {
    if (!tablaBody) return;

    // Aplicar filtro activo si es diferente de 'todos'
    let listaFiltrada = movimientos;
    if (filtroMetodoActivo !== 'todos') {
      listaFiltrada = movimientos.filter(m =>
        (m.metodoPago || '').toLowerCase().includes(filtroMetodoActivo.toLowerCase())
      );
    }

    tablaBody.innerHTML = '';

    if (listaFiltrada.length === 0) {
      if (reporteVacio) reporteVacio.style.display = 'block';
      if (tableContainer) tableContainer.style.display = 'none';
      return;
    }

    if (reporteVacio) reporteVacio.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    const esc = typeof window.escaparHtml === 'function' ? window.escaparHtml : (x) => String(x ?? '');

    listaFiltrada.forEach(m => {
      const tr = document.createElement('tr');
      const metodoNorm = (m.metodoPago || '').toLowerCase();
      const esEfectivo = metodoNorm.includes('efectivo');
      const esPos = metodoNorm.includes('pos') || metodoNorm.includes('tarjeta');
      const esCulqi = metodoNorm.includes('culqi');
      const badgeClase = esEfectivo ? 'badge-metodo-efectivo' : 'badge-metodo-yape';
      const icono = esEfectivo ? '💵' : (esPos ? '💳' : (esCulqi ? '🌐' : '📱'));

      tr.innerHTML = `
        <td class="mono" style="font-weight: 700; color: #1e3a8a;">${esc(m.placa)}</td>
        <td>${esc(m.tipoVehiculo)}</td>
        <td class="mono">${esc(m.horaSalida)}</td>
        <td>
          <span class="${badgeClase}">${icono} ${esc(m.metodoPago)}</span>
        </td>
        <td class="mono" style="text-align: right; font-weight: 600; color: #111827;">${formatearMoneda(m.monto)}</td>
      `;
      tablaBody.appendChild(tr);
    });
  }

  // Interactividad de filtros por métodos de pago
  function setFiltro(metodo) {
    filtroMetodoActivo = metodo;
    actualizarEstilosPills();
    renderizarTabla(transaccionesActuales);
  }

  function actualizarEstilosPills() {
    [pillTodos, pillEfectivo, pillYape, pillPos, pillCulqi].forEach(p => {
      if (p) p.classList.remove('active');
    });

    if (cardFiltroEfectivo) cardFiltroEfectivo.classList.remove('active-filter');
    if (cardFiltroYape) cardFiltroYape.classList.remove('active-filter');

    if (filtroMetodoActivo === 'todos') {
      if (pillTodos) pillTodos.classList.add('active');
    } else if (filtroMetodoActivo === 'Efectivo') {
      if (pillEfectivo) pillEfectivo.classList.add('active');
      if (cardFiltroEfectivo) cardFiltroEfectivo.classList.add('active-filter');
    } else if (filtroMetodoActivo === 'Yape') {
      if (pillYape) pillYape.classList.add('active');
      if (cardFiltroYape) cardFiltroYape.classList.add('active-filter');
    } else if (filtroMetodoActivo === 'POS') {
      if (pillPos) pillPos.classList.add('active');
      if (cardFiltroYape) cardFiltroYape.classList.add('active-filter');
    } else if (filtroMetodoActivo === 'Culqi Online') {
      if (pillCulqi) pillCulqi.classList.add('active');
      if (cardFiltroYape) cardFiltroYape.classList.add('active-filter');
    }
  }

  if (pillTodos) {
    pillTodos.addEventListener('click', () => setFiltro('todos'));
  }
  if (pillEfectivo) {
    pillEfectivo.addEventListener('click', () => setFiltro('Efectivo'));
  }
  if (pillYape) {
    pillYape.addEventListener('click', () => setFiltro('Yape'));
  }
  if (pillPos) {
    pillPos.addEventListener('click', () => setFiltro('POS'));
  }
  if (pillCulqi) {
    pillCulqi.addEventListener('click', () => setFiltro('Culqi Online'));
  }

  // También permitir filtrar al hacer clic en las tarjetas de resumen
  if (cardFiltroEfectivo) {
    cardFiltroEfectivo.addEventListener('click', () => {
      setFiltro(filtroMetodoActivo === 'Efectivo' ? 'todos' : 'Efectivo');
    });
  }
  if (cardFiltroYape) {
    cardFiltroYape.addEventListener('click', () => {
      setFiltro(filtroMetodoActivo === 'Yape' ? 'todos' : 'Yape');
    });
  }
});
