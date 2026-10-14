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
  const pillCountTodos = document.getElementById('pill-count-todos');
  const cardFiltroEfectivo = document.getElementById('card-filtro-efectivo');
  const cardFiltroYape = document.getElementById('card-filtro-yape');

  // Estado interno en memoria
  let transaccionesActuales = [];
  let filtroMetodoActivo = 'todos';

  // Datos mock para enriquecer fechas anteriores durante la fase de prototipado
  const DEMO_TRANSACCIONES_FECHAS = {
    // Ejemplo de ayer
    ayer: [
      { id: 101, placa: 'ABC-123', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '18:40', metodoPago: 'Efectivo', monto: 14.00 },
      { id: 102, placa: 'BCF-456', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '17:15', metodoPago: 'Yape', monto: 21.00 },
      { id: 103, placa: 'M1-9876', tipoVehiculo: 'Motocicleta', horaSalida: '16:05', metodoPago: 'Efectivo', monto: 7.50 },
      { id: 104, placa: 'T2A-101', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '14:20', metodoPago: 'Yape', monto: 10.50 },
      { id: 105, placa: 'ACB-7890', tipoVehiculo: 'Motocicleta', horaSalida: '11:50', metodoPago: 'Efectivo', monto: 5.00 },
      { id: 106, placa: 'XYZ-999', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '09:30', metodoPago: 'Yape', monto: 17.50 }
    ],
    // Ejemplo de anteayer
    anteayer: [
      { id: 201, placa: 'DEF-789', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '19:10', metodoPago: 'Efectivo', monto: 28.00 },
      { id: 202, placa: 'GHI-321', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '15:45', metodoPago: 'Yape', monto: 14.00 },
      { id: 203, placa: '2345-AB', tipoVehiculo: 'Motocicleta', horaSalida: '12:15', metodoPago: 'Efectivo', monto: 10.00 },
      { id: 204, placa: 'P1-5544', tipoVehiculo: 'Motocicleta', horaSalida: '10:00', metodoPago: 'Yape', monto: 7.50 }
    ]
  };

  function obtenerFechaHoyISO() {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
      document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
      });
      if (viewReportes) viewReportes.classList.add('active');
      inicializarSelectorFecha();
      consultarRecaudacion(inputFecha.value);
    });
  }

  if (btnBackToMenu) {
    btnBackToMenu.addEventListener('click', (e) => {
      e.preventDefault();
      if (viewReportes) viewReportes.classList.remove('active');
      if (viewDashboard) viewDashboard.classList.add('active');
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
      let data = null;
      try {
        const res = await fetch(`/api/reportes/diario?fecha=${fechaISO}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch (e) {
        console.warn('API no disponible temporalmente, usando fallback de prototipo.');
      }

      // Si la API no devolvió movimientos y es una fecha para probar el prototipo:
      let movimientos = data && data.movimientos ? data.movimientos : [];

      if (movimientos.length === 0) {
        // Enriquecer demostrativamente según la fecha para que el prototipo interactivo
        // muestre recaudación del día actual y de fechas anteriores como pide Jira
        const hoyISO = obtenerFechaHoyISO();
        const dActual = new Date(fechaISO + 'T00:00:00');
        const dHoy = new Date(hoyISO + 'T00:00:00');
        const diffDias = Math.round((dHoy - dActual) / (1000 * 60 * 60 * 24));

        if (diffDias === 0 && movimientos.length === 0) {
          // Si hoy no hay cobros aún en BD, mostramos transacciones modelo del día
          movimientos = [
            { id: 1, placa: 'ABC-123', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '09:45', metodoPago: 'Efectivo', monto: 7.00 },
            { id: 2, placa: 'T2A-101', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '10:15', metodoPago: 'Yape', monto: 10.50 },
            { id: 3, placa: 'ACB-0000', tipoVehiculo: 'Motocicleta', horaSalida: '10:50', metodoPago: 'Efectivo', monto: 5.00 },
            { id: 4, placa: 'A1-2345', tipoVehiculo: 'Motocicleta', horaSalida: '11:20', metodoPago: 'Yape', monto: 7.50 },
            { id: 5, placa: 'D4F-567', tipoVehiculo: 'Automóvil / Camioneta', horaSalida: '11:45', metodoPago: 'Efectivo', monto: 14.00 }
          ];
        } else if (diffDias === 1) {
          movimientos = DEMO_TRANSACCIONES_FECHAS.ayer;
        } else if (diffDias === 2) {
          movimientos = DEMO_TRANSACCIONES_FECHAS.anteayer;
        }
        // Fechas más antiguas mostrarán el estado sin movimientos definido en la especificación
      }

      transaccionesActuales = movimientos;
      filtroMetodoActivo = 'todos';
      actualizarEstilosPills();
      actualizarTotales(transaccionesActuales);
      renderizarTabla(transaccionesActuales);

    } catch (err) {
      console.error('Error al consultar recaudación:', err);
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
    let countEfectivo = 0;
    let countYape = 0;

    movimientos.forEach(m => {
      const metodo = (m.metodoPago || '').toLowerCase();
      const monto = Number(m.monto) || 0;
      if (metodo.includes('efectivo')) {
        totalEfectivo += monto;
        countEfectivo++;
      } else if (metodo.includes('yape')) {
        totalYape += monto;
        countYape++;
      }
    });

    const totalGeneral = totalEfectivo + totalYape;

    if (totalEfectivoEl) totalEfectivoEl.textContent = formatearMoneda(totalEfectivo);
    if (totalYapeEl) totalYapeEl.textContent = formatearMoneda(totalYape);
    if (totalGeneralEl) totalGeneralEl.textContent = formatearMoneda(totalGeneral);

    if (countEfectivoEl) countEfectivoEl.textContent = `${countEfectivo} cobro${countEfectivo === 1 ? '' : 's'}`;
    if (countYapeEl) countYapeEl.textContent = `${countYape} cobro${countYape === 1 ? '' : 's'}`;
    if (pillCountTodos) pillCountTodos.textContent = movimientos.length;

    // Actualizar barra de desglose porcentual
    if (barFisico && barDigital && lblPctFisico && lblPctDigital) {
      if (totalGeneral > 0) {
        const pctFisico = Math.round((totalEfectivo / totalGeneral) * 100);
        const pctDigital = 100 - pctFisico;

        barFisico.style.width = `${pctFisico}%`;
        barDigital.style.width = `${pctDigital}%`;

        lblPctFisico.textContent = `💵 ${pctFisico}% Físico (${formatearMoneda(totalEfectivo)})`;
        lblPctDigital.textContent = `📱 ${pctDigital}% Digital (${formatearMoneda(totalYape)})`;
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

    listaFiltrada.forEach(m => {
      const tr = document.createElement('tr');
      const esEfectivo = (m.metodoPago || '').toLowerCase().includes('efectivo');
      const badgeClase = esEfectivo ? 'badge-metodo-efectivo' : 'badge-metodo-yape';
      const icono = esEfectivo ? '💵' : '📱';

      tr.innerHTML = `
        <td class="mono" style="font-weight: 700; color: #1e3a8a;">${m.placa}</td>
        <td>${m.tipoVehiculo}</td>
        <td class="mono">${m.horaSalida}</td>
        <td>
          <span class="${badgeClase}">${icono} ${m.metodoPago}</span>
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
    [pillTodos, pillEfectivo, pillYape].forEach(p => {
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
