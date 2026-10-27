/**
 * Módulo de Gráficos Estadísticos (UPAO-18 / UPAO-65)
 * Dashboard interactivo para el rol DUEÑO: selector de período, métricas,
 * gráficos y exportación CSV conectados a la API de reportes.
 */
document.addEventListener('DOMContentLoaded', () => {
  const ANIO_MINIMO = 2024;
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const cardModulo = document.getElementById('card-modulo-estadisticas');
  const btnBack = document.getElementById('btn-back-to-menu-estadisticas');
  const viewEstadisticas = document.getElementById('view-estadisticas');
  const viewDashboard = document.getElementById('view-dashboard');

  const btnModoMensual = document.getElementById('modo-mensual');
  const btnModoAnual = document.getElementById('modo-anual');
  const grupoMes = document.getElementById('grupo-mes-estadisticas');
  const selectAnio = document.getElementById('select-anio-estadisticas');
  const selectMes = document.getElementById('select-mes-estadisticas');
  const btnConsultar = document.getElementById('btn-consultar-estadisticas');
  const btnExportar = document.getElementById('btn-exportar-estadisticas');
  const errorPeriodo = document.getElementById('error-periodo-estadisticas');

  const metricaTotal = document.getElementById('metrica-total');
  const metricaEfectivo = document.getElementById('metrica-efectivo');
  const metricaYape = document.getElementById('metrica-yape');
  const metricaVehiculos = document.getElementById('metrica-vehiculos');
  const metricaPeriodo = document.getElementById('metrica-periodo');
  const metricaPctEfectivo = document.getElementById('metrica-pct-efectivo');
  const metricaPctYape = document.getElementById('metrica-pct-yape');

  const chartsGrid = document.getElementById('charts-grid-estadisticas');
  const estadoVacio = document.getElementById('estadisticas-vacio');
  const tituloBarras = document.getElementById('titulo-grafico-barras');
  const subtituloBarras = document.getElementById('subtitulo-grafico-barras');
  const contBarras = document.getElementById('chart-barras');
  const contDona = document.getElementById('chart-dona');
  const contHoras = document.getElementById('chart-horas');
  const tooltip = document.getElementById('chart-tooltip');

  let modo = 'mensual';
  let datos = null;
  let periodo = { anio: 0, mes: 0 };

  function ahoraPeru() {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const obtener = (tipo) => Number(partes.find((parte) => parte.type === tipo).value);
    return { anio: obtener('year'), mes: obtener('month'), dia: obtener('day') };
  }

  const HOY = ahoraPeru();

  function formatearMoneda(valor) {
    const numero = Number(valor) || 0;
    return `S/ ${numero.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatearPorcentaje(valor) {
    return `${(Number(valor) || 0).toFixed(1)}%`;
  }

  function formatearDia(anio, mes, dia) {
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
  }

  function poblarAnios() {
    if (!selectAnio) return;

    selectAnio.innerHTML = '';
    for (let anio = ANIO_MINIMO; anio <= HOY.anio; anio += 1) {
      const opcion = document.createElement('option');
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      selectAnio.appendChild(opcion);
    }
    selectAnio.value = String(HOY.anio);
  }

  function poblarMeses() {
    if (!selectMes || !selectAnio) return;

    const anio = Number(selectAnio.value);
    const maximoMes = anio === HOY.anio ? HOY.mes : 12;
    const valorPrevio = Number(selectMes.value) || maximoMes;

    selectMes.innerHTML = '';
    MESES.forEach((nombre, indice) => {
      const mes = indice + 1;
      const opcion = document.createElement('option');
      opcion.value = String(mes);
      opcion.textContent = nombre;
      if (mes > maximoMes) opcion.disabled = true;
      selectMes.appendChild(opcion);
    });

    selectMes.value = String(Math.min(valorPrevio, maximoMes));
  }

  function actualizarModo(reconsultar = true) {
    const esAnual = modo === 'anual';

    if (btnModoMensual) btnModoMensual.classList.toggle('active', !esAnual);
    if (btnModoAnual) btnModoAnual.classList.toggle('active', esAnual);
    if (grupoMes) grupoMes.style.display = esAnual ? 'none' : '';

    if (tituloBarras) {
      tituloBarras.textContent = esAnual ? 'Ingresos Mensuales del Año' : 'Ingresos Diarios del Mes';
    }
    if (subtituloBarras) {
      subtituloBarras.textContent = esAnual
        ? 'Eje X: meses del año · Eje Y: recaudación (S/)'
        : 'Eje X: días del mes · Eje Y: recaudación (S/)';
    }

    if (reconsultar) consultar();
  }

  function mostrarErrorPeriodo(mensaje) {
    if (!errorPeriodo) return;
    errorPeriodo.textContent = mensaje;
    errorPeriodo.style.display = 'block';
  }

  function ocultarErrorPeriodo() {
    if (errorPeriodo) errorPeriodo.style.display = 'none';
  }

  async function consultar() {
    if (!selectAnio || !selectMes) return;

    const anio = Number(selectAnio.value);
    const mes = Number(selectMes.value) || 1;

    if (anio > HOY.anio) {
      mostrarErrorPeriodo('No se pueden consultar períodos futuros.');
      return;
    }

    if (modo === 'mensual' && anio === HOY.anio && mes > HOY.mes) {
      mostrarErrorPeriodo('No se pueden consultar meses futuros. Seleccione el mes actual o uno anterior.');
      return;
    }

    periodo = { anio, mes: modo === 'mensual' ? mes : null };

    if (btnConsultar) {
      btnConsultar.disabled = true;
      btnConsultar.textContent = 'Consultando...';
    }

    try {
      const parametros = new URLSearchParams({ periodo: modo, anio: String(anio) });
      if (modo === 'mensual') parametros.set('mes', String(mes));

      const respuesta = await fetch(`/api/reportes/graficos?${parametros.toString()}`);
      const data = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(data.error || 'No se pudieron obtener los datos estadísticos.');
      }

      datos = data;
      ocultarErrorPeriodo();
    } catch (error) {
      datos = null;
      mostrarErrorPeriodo(error.message);
    } finally {
      if (btnConsultar) {
        btnConsultar.disabled = false;
        btnConsultar.textContent = 'Consultar';
      }
      renderMetricas();
      renderGraficos();
      renderEstadoExportacion();
    }
  }

  function renderMetricas() {
    const totales = datos && datos.totales
      ? datos.totales
      : { totalGeneral: 0, totalEfectivo: 0, totalYape: 0, concurrenciaTotal: 0, porcentajeEfectivo: 0, porcentajeYape: 0 };

    if (metricaTotal) metricaTotal.textContent = formatearMoneda(totales.totalGeneral);
    if (metricaEfectivo) metricaEfectivo.textContent = formatearMoneda(totales.totalEfectivo);
    if (metricaYape) metricaYape.textContent = formatearMoneda(totales.totalYape);
    if (metricaVehiculos) metricaVehiculos.textContent = Number(totales.concurrenciaTotal || 0).toLocaleString('es-PE');
    if (metricaPeriodo) metricaPeriodo.textContent = datos && datos.etiquetaPeriodo ? datos.etiquetaPeriodo : '—';
    if (metricaPctEfectivo) metricaPctEfectivo.textContent = formatearPorcentaje(totales.porcentajeEfectivo);
    if (metricaPctYape) metricaPctYape.textContent = formatearPorcentaje(totales.porcentajeYape);
  }

  function renderGraficos() {
    const tieneDatos = !!(datos && datos.tieneDatos);

    if (chartsGrid) chartsGrid.style.display = tieneDatos ? '' : 'none';
    if (estadoVacio) estadoVacio.style.display = tieneDatos ? 'none' : '';

    if (!tieneDatos) {
      [contBarras, contDona, contHoras].forEach((contenedor) => {
        if (contenedor) contenedor.innerHTML = '';
      });
      return;
    }

    if (modo === 'anual') {
      const serie = datos.serieMensual || [];
      dibujarBarras(
        contBarras,
        serie.map((fila) => MESES_CORTOS[fila.mes - 1]),
        serie.map((fila) => fila.monto),
        serie.map((fila) => `<strong>${MESES[fila.mes - 1]} ${periodo.anio}</strong><br>${formatearMoneda(fila.monto)} · ${fila.vehiculos} vehículos`),
        'money'
      );
    } else {
      const serie = datos.serieDiaria || [];
      dibujarBarras(
        contBarras,
        serie.map((fila) => String(fila.dia)),
        serie.map((fila) => fila.monto),
        serie.map((fila) => `<strong>${formatearDia(periodo.anio, periodo.mes, fila.dia)}</strong><br>${formatearMoneda(fila.monto)} · ${fila.vehiculos} vehículos`),
        'money'
      );
    }

    dibujarDona(contDona, datos.totales);

    const horaria = datos.concurrenciaHoraria || [];
    dibujarBarras(
      contHoras,
      horaria.map((fila) => `${String(fila.hora).padStart(2, '0')}:00`),
      horaria.map((fila) => fila.vehiculos),
      horaria.map((fila) => `<strong>Hora ${String(fila.hora).padStart(2, '0')}:00</strong><br>${fila.vehiculos} vehículos · ${formatearMoneda(fila.monto)}`),
      'count'
    );
  }

  function renderEstadoExportacion() {
    if (!btnExportar) return;
    const tieneDatos = !!(datos && datos.tieneDatos);
    btnExportar.disabled = !tieneDatos;
    btnExportar.classList.toggle('export-deshabilitado', !tieneDatos);
    btnExportar.title = tieneDatos ? 'Exportar a CSV/Excel' : 'No hay datos disponibles para exportar';
  }

  function elegirPaso(maximo, tipo) {
    if (tipo === 'count') {
      const pasos = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
      return pasos.find((paso) => paso * 4 >= maximo) || Math.ceil(maximo / 400) * 100;
    }
    const pasos = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
    return pasos.find((paso) => paso * 4 >= maximo) || Math.ceil(maximo / 4000) * 1000;
  }

  function mostrarTooltip(evento, contenido) {
    if (!tooltip) return;
    tooltip.innerHTML = contenido;
    tooltip.style.display = 'block';
    moverTooltip(evento);
  }

  function moverTooltip(evento) {
    if (!tooltip) return;
    tooltip.style.left = `${evento.clientX + 14}px`;
    tooltip.style.top = `${evento.clientY - 38}px`;
  }

  function ocultarTooltip() {
    if (tooltip) tooltip.style.display = 'none';
  }

  function dibujarBarras(contenedor, etiquetas, valores, textos, tipo) {
    if (!contenedor) return;

    const ancho = 760;
    const alto = 300;
    const margenIzquierdo = 84;
    const margenDerecho = 14;
    const margenSuperior = 16;
    const margenInferior = 40;
    const anchoUtil = ancho - margenIzquierdo - margenDerecho;
    const altoUtil = alto - margenSuperior - margenInferior;
    const maximo = Math.max(0, ...valores);
    const paso = elegirPaso(maximo, tipo);
    const maximoEje = maximo > 0 ? Math.ceil(maximo / paso) * paso : paso * 4;
    const anchoBarra = anchoUtil / Math.max(1, valores.length);

    let svg = `<svg viewBox="0 0 ${ancho} ${alto}" class="chart-svg" role="img" aria-label="Gráfico de recaudación">`;

    for (let indice = 0; indice <= 4; indice += 1) {
      const valor = (maximoEje / 4) * indice;
      const y = margenSuperior + altoUtil - (valor / maximoEje) * altoUtil;
      const etiqueta = tipo === 'money' ? formatearMoneda(valor) : String(Math.round(valor));
      svg += `<line x1="${margenIzquierdo}" y1="${y}" x2="${ancho - margenDerecho}" y2="${y}" class="chart-grid-line" />`;
      svg += `<text x="${margenIzquierdo - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-label mono">${etiqueta}</text>`;
    }

    valores.forEach((valor, indice) => {
      const altura = maximoEje > 0 ? (valor / maximoEje) * altoUtil : 0;
      const x = margenIzquierdo + indice * anchoBarra + anchoBarra * 0.18;
      const y = margenSuperior + altoUtil - altura;
      svg += `<rect class="chart-bar" data-idx="${indice}" x="${x}" y="${y}" width="${anchoBarra * 0.64}" height="${Math.max(altura, 0)}" rx="2" />`;
    });

    const cadaEtiqueta = etiquetas.length > 16 ? Math.ceil(etiquetas.length / 8) : 1;
    etiquetas.forEach((etiqueta, indice) => {
      if (indice % cadaEtiqueta !== 0 && indice !== etiquetas.length - 1) return;
      const x = margenIzquierdo + indice * anchoBarra + anchoBarra / 2;
      svg += `<text x="${x}" y="${alto - 14}" text-anchor="middle" class="chart-axis-label">${etiqueta}</text>`;
    });

    svg += '</svg>';
    contenedor.innerHTML = svg;

    contenedor.querySelectorAll('.chart-bar').forEach((barra) => {
      const indice = Number(barra.getAttribute('data-idx'));
      barra.addEventListener('mouseenter', (evento) => mostrarTooltip(evento, textos[indice]));
      barra.addEventListener('mousemove', moverTooltip);
      barra.addEventListener('mouseleave', ocultarTooltip);
    });
  }

  function colorMetodo(nombre) {
    const texto = String(nombre || '').toLowerCase();
    if (texto.includes('efectivo')) return '#1E3A8A';
    if (texto.includes('yape')) return '#10B981';
    if (texto.includes('pos')) return '#F59E0B';
    return '#6B7280';
  }

  function dibujarDona(contenedor, totales) {
    if (!contenedor) return;

    const items = Array.isArray(totales.porMetodo) && totales.porMetodo.length > 0
      ? totales.porMetodo
      : [
        { nombre: 'Efectivo', monto: totales.totalEfectivo, porcentaje: totales.porcentajeEfectivo },
        { nombre: 'Yape', monto: totales.totalYape, porcentaje: totales.porcentajeYape }
      ];
    const total = Number(totales.totalGeneral) || 0;
    const tamano = 220;
    const centro = 110;
    const radio = 76;
    const grosor = 28;
    const circunferencia = 2 * Math.PI * radio;
    let acumulado = 0;
    let segmentos = '';

    items.forEach((item, indice) => {
      const proporcion = total > 0 ? (Number(item.monto) || 0) / total : 0;
      const arco = circunferencia * proporcion;
      if (arco > 0.01) {
        segmentos += `<circle class="dona-segmento" data-idx="${indice}" cx="${centro}" cy="${centro}" r="${radio}" fill="none" stroke="${colorMetodo(item.nombre)}" stroke-width="${grosor}" stroke-dasharray="${arco} ${circunferencia - arco}" stroke-dashoffset="${-acumulado}" transform="rotate(-90 ${centro} ${centro})" />`;
      }
      acumulado += arco;
    });

    const svg = `<svg viewBox="0 0 ${tamano} ${tamano}" class="chart-svg dona-svg" role="img" aria-label="Distribución por método de pago">
      <circle cx="${centro}" cy="${centro}" r="${radio}" fill="none" stroke="#E5E7EB" stroke-width="${grosor}" />
      ${segmentos}
      <text x="${centro}" y="${centro - 6}" text-anchor="middle" class="dona-centro-label">TOTAL</text>
      <text x="${centro}" y="${centro + 16}" text-anchor="middle" class="dona-centro-valor mono">${formatearMoneda(total)}</text>
    </svg>`;

    const leyenda = `<div class="dona-leyenda">
      ${items.map((item) => `
        <div class="dona-item">
          <span class="dona-dot" style="background:${colorMetodo(item.nombre)}"></span>
          <span class="dona-item-label">${item.nombre}</span>
          <span class="dona-item-valor mono">${formatearMoneda(item.monto)}</span>
          <span class="dona-item-pct mono">${formatearPorcentaje(item.porcentaje)}</span>
        </div>`).join('')}
    </div>`;

    contenedor.innerHTML = svg + leyenda;

    contenedor.querySelectorAll('.dona-segmento').forEach((segmento) => {
      const item = items[Number(segmento.getAttribute('data-idx'))];
      segmento.addEventListener('mouseenter', (evento) => {
        mostrarTooltip(evento, `<strong>${item.nombre}</strong><br>${formatearMoneda(item.monto)} · ${formatearPorcentaje(item.porcentaje)}`);
      });
      segmento.addEventListener('mousemove', moverTooltip);
      segmento.addEventListener('mouseleave', ocultarTooltip);
    });
  }

  function exportarCsv() {
    if (!datos || !datos.tieneDatos) return;

    const parametros = new URLSearchParams({ periodo: modo, anio: String(periodo.anio) });
    if (modo === 'mensual') parametros.set('mes', String(periodo.mes));

    const enlace = document.createElement('a');
    enlace.href = `/api/reportes/exportar?${parametros.toString()}`;
    enlace.download = '';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  }

  if (cardModulo) {
    cardModulo.addEventListener('click', (evento) => {
      evento.preventDefault();
      document.querySelectorAll('.view-section').forEach((seccion) => seccion.classList.remove('active'));
      if (viewEstadisticas) viewEstadisticas.classList.add('active');
      if (selectAnio) selectAnio.value = String(HOY.anio);
      poblarMeses();
      if (modo === 'mensual' && selectMes) selectMes.value = String(HOY.mes);
      consultar();
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', (evento) => {
      evento.preventDefault();
      if (viewEstadisticas) viewEstadisticas.classList.remove('active');
      if (viewDashboard) viewDashboard.classList.add('active');
    });
  }

  if (btnModoMensual) {
    btnModoMensual.addEventListener('click', () => {
      modo = 'mensual';
      actualizarModo();
    });
  }

  if (btnModoAnual) {
    btnModoAnual.addEventListener('click', () => {
      modo = 'anual';
      actualizarModo();
    });
  }

  if (selectAnio) {
    selectAnio.addEventListener('change', () => {
      poblarMeses();
      consultar();
    });
  }

  if (selectMes) {
    selectMes.addEventListener('change', consultar);
  }

  if (btnConsultar) {
    btnConsultar.addEventListener('click', consultar);
  }

  if (btnExportar) {
    btnExportar.addEventListener('click', exportarCsv);
  }

  poblarAnios();
  poblarMeses();
  actualizarModo(false);
  consultar();
});
