/**
 * Módulo de Gráficos Estadísticos (UPAO-18 / UPAO-65)
 * Dashboard interactivo para el rol DUEÑO: selector de período, métricas,
 * gráficos y exportación CSV. Datos demo hasta la integración de la API.
 */
document.addEventListener('DOMContentLoaded', () => {
  const ANIO_MINIMO = 2024;
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const COLOR_EFECTIVO = '#1E3A8A';
  const COLOR_YAPE = '#10B981';
  const TIPO_AUTO = 'Automóvil / Camioneta';
  const TIPO_MOTO = 'Motocicleta';

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
  let transacciones = [];
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

  function formatearFechaHora(fecha) {
    return new Date(fecha).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');
  }

  function formatearDia(anio, mes, dia) {
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
  }

  function crearRng(semilla) {
    let estado = semilla >>> 0;
    return () => {
      estado |= 0;
      estado = (estado + 0x6D2B79F5) | 0;
      let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function letra(rng) {
    return LETRAS[Math.floor(rng() * LETRAS.length)];
  }

  function digito(rng) {
    return String(Math.floor(rng() * 10));
  }

  function generarPlaca(rng, esAuto) {
    if (esAuto) {
      return `${letra(rng)}${letra(rng)}${letra(rng)}-${digito(rng)}${digito(rng)}${digito(rng)}`;
    }
    if (rng() < 0.5) {
      return `${digito(rng)}${digito(rng)}${digito(rng)}${digito(rng)}-${letra(rng)}${letra(rng)}`;
    }
    return `${letra(rng)}${letra(rng)}${letra(rng)}-${digito(rng)}${digito(rng)}${digito(rng)}${digito(rng)}`;
  }

  function generarMes(anio, mes) {
    if (anio < 2026 || anio > HOY.anio) return [];
    if (anio === HOY.anio && mes > HOY.mes) return [];

    const rng = crearRng(anio * 100 + mes);
    const diasDelMes = new Date(anio, mes, 0).getDate();
    const ultimoDia = anio === HOY.anio && mes === HOY.mes ? HOY.dia : diasDelMes;
    const lista = [];
    let id = 1;

    for (let dia = 1; dia <= ultimoDia; dia += 1) {
      const fechaDia = new Date(anio, mes - 1, dia);
      const esFinDeSemana = fechaDia.getDay() === 0 || fechaDia.getDay() === 6;
      const cantidad = 5 + Math.floor(rng() * 6) + (esFinDeSemana ? 3 : 0);

      for (let i = 0; i < cantidad; i += 1) {
        const esAuto = rng() < 0.7;
        const hora = 7 + Math.floor(rng() * 15);
        const minuto = Math.floor(rng() * 60);
        const metodo = rng() < 0.62 ? 'Efectivo' : 'Yape';
        const monto = Math.round((esAuto ? 5 + rng() * 25 : 3 + rng() * 9) * 2) / 2;
        const fecha = new Date(
          `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-05:00`
        );

        lista.push({
          id: id++,
          fecha,
          anio,
          mes,
          dia,
          hora,
          placa: generarPlaca(rng, esAuto),
          tipo: esAuto ? TIPO_AUTO : TIPO_MOTO,
          metodo,
          monto
        });
      }
    }

    return lista;
  }

  function obtenerTransacciones(anio, mes) {
    if (mes !== null) return generarMes(anio, mes);

    const lista = [];
    for (let m = 1; m <= 12; m += 1) {
      if (anio === HOY.anio && m > HOY.mes) break;
      lista.push(...generarMes(anio, m));
    }
    return lista;
  }

  function calcularTotales(lista) {
    let efectivo = 0;
    let yape = 0;

    lista.forEach((item) => {
      if (item.metodo === 'Efectivo') efectivo += item.monto;
      else yape += item.monto;
    });

    const total = efectivo + yape;

    return {
      total,
      efectivo,
      yape,
      vehiculos: lista.length,
      pctEfectivo: total > 0 ? (efectivo / total) * 100 : 0,
      pctYape: total > 0 ? (yape / total) * 100 : 0
    };
  }

  function serieDiaria(lista, anio, mes) {
    const dias = new Date(anio, mes, 0).getDate();
    const serie = Array.from({ length: dias }, (_, indice) => ({
      dia: indice + 1,
      monto: 0,
      efectivo: 0,
      yape: 0,
      vehiculos: 0
    }));

    lista.forEach((item) => {
      const fila = serie[item.dia - 1];
      if (!fila) return;
      fila.monto += item.monto;
      fila.vehiculos += 1;
      if (item.metodo === 'Efectivo') fila.efectivo += item.monto;
      else fila.yape += item.monto;
    });

    return serie;
  }

  function serieMensual(lista) {
    const serie = MESES_CORTOS.map((nombre, indice) => ({
      mes: indice + 1,
      nombre,
      monto: 0,
      efectivo: 0,
      yape: 0,
      vehiculos: 0
    }));

    lista.forEach((item) => {
      const fila = serie[item.mes - 1];
      if (!fila) return;
      fila.monto += item.monto;
      fila.vehiculos += 1;
      if (item.metodo === 'Efectivo') fila.efectivo += item.monto;
      else fila.yape += item.monto;
    });

    return serie;
  }

  function serieHoraria(lista) {
    const serie = Array.from({ length: 18 }, (_, indice) => ({
      hora: indice + 6,
      vehiculos: 0,
      monto: 0
    }));

    lista.forEach((item) => {
      if (item.hora < 6 || item.hora > 23) return;
      const fila = serie[item.hora - 6];
      fila.vehiculos += 1;
      fila.monto += item.monto;
    });

    return serie;
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

  function consultar() {
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

    ocultarErrorPeriodo();

    periodo = { anio, mes: modo === 'mensual' ? mes : null };
    transacciones = obtenerTransacciones(anio, periodo.mes);

    renderMetricas();
    renderGraficos();
    renderEstadoExportacion();
  }

  function renderMetricas() {
    const totales = calcularTotales(transacciones);
    const etiquetaPeriodo = modo === 'anual'
      ? `Año ${periodo.anio}`
      : `${MESES[periodo.mes - 1]} ${periodo.anio}`;

    if (metricaTotal) metricaTotal.textContent = formatearMoneda(totales.total);
    if (metricaEfectivo) metricaEfectivo.textContent = formatearMoneda(totales.efectivo);
    if (metricaYape) metricaYape.textContent = formatearMoneda(totales.yape);
    if (metricaVehiculos) metricaVehiculos.textContent = totales.vehiculos.toLocaleString('es-PE');
    if (metricaPeriodo) metricaPeriodo.textContent = etiquetaPeriodo;
    if (metricaPctEfectivo) metricaPctEfectivo.textContent = formatearPorcentaje(totales.pctEfectivo);
    if (metricaPctYape) metricaPctYape.textContent = formatearPorcentaje(totales.pctYape);
  }

  function renderGraficos() {
    const tieneDatos = transacciones.length > 0;

    if (chartsGrid) chartsGrid.style.display = tieneDatos ? '' : 'none';
    if (estadoVacio) estadoVacio.style.display = tieneDatos ? 'none' : '';

    if (!tieneDatos) {
      [contBarras, contDona, contHoras].forEach((contenedor) => {
        if (contenedor) contenedor.innerHTML = '';
      });
      return;
    }

    const totales = calcularTotales(transacciones);

    if (modo === 'anual') {
      const serie = serieMensual(transacciones);
      dibujarBarras(
        contBarras,
        serie.map((fila) => fila.nombre),
        serie.map((fila) => fila.monto),
        serie.map((fila) => `<strong>${MESES[fila.mes - 1]} ${periodo.anio}</strong><br>${formatearMoneda(fila.monto)} · ${fila.vehiculos} vehículos`),
        'money'
      );
    } else {
      const serie = serieDiaria(transacciones, periodo.anio, periodo.mes);
      dibujarBarras(
        contBarras,
        serie.map((fila) => String(fila.dia)),
        serie.map((fila) => fila.monto),
        serie.map((fila) => `<strong>${formatearDia(periodo.anio, periodo.mes, fila.dia)}</strong><br>${formatearMoneda(fila.monto)} · ${fila.vehiculos} vehículos`),
        'money'
      );
    }

    dibujarDona(contDona, totales);

    const horaria = serieHoraria(transacciones);
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
    const tieneDatos = transacciones.length > 0;
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

  function dibujarDona(contenedor, totales) {
    if (!contenedor) return;

    const tamano = 220;
    const centro = 110;
    const radio = 76;
    const grosor = 28;
    const circunferencia = 2 * Math.PI * radio;
    const proporcionEfectivo = totales.total > 0 ? totales.efectivo / totales.total : 0;
    const arcoEfectivo = circunferencia * proporcionEfectivo;
    const arcoYape = circunferencia - arcoEfectivo;

    let svg = `<svg viewBox="0 0 ${tamano} ${tamano}" class="chart-svg dona-svg" role="img" aria-label="Distribución por método de pago">`;
    svg += `<circle cx="${centro}" cy="${centro}" r="${radio}" fill="none" stroke="#E5E7EB" stroke-width="${grosor}" />`;

    if (totales.total > 0) {
      svg += `<circle class="dona-segmento" data-metodo="Efectivo" cx="${centro}" cy="${centro}" r="${radio}" fill="none" stroke="${COLOR_EFECTIVO}" stroke-width="${grosor}" stroke-dasharray="${arcoEfectivo} ${circunferencia - arcoEfectivo}" transform="rotate(-90 ${centro} ${centro})" />`;
      svg += `<circle class="dona-segmento" data-metodo="Yape" cx="${centro}" cy="${centro}" r="${radio}" fill="none" stroke="${COLOR_YAPE}" stroke-width="${grosor}" stroke-dasharray="${arcoYape} ${circunferencia - arcoYape}" stroke-dashoffset="${-arcoEfectivo}" transform="rotate(-90 ${centro} ${centro})" />`;
    }

    svg += `<text x="${centro}" y="${centro - 6}" text-anchor="middle" class="dona-centro-label">TOTAL</text>`;
    svg += `<text x="${centro}" y="${centro + 16}" text-anchor="middle" class="dona-centro-valor mono">${formatearMoneda(totales.total)}</text>`;
    svg += '</svg>';

    const leyenda = `
      <div class="dona-leyenda">
        <div class="dona-item">
          <span class="dona-dot" style="background:${COLOR_EFECTIVO}"></span>
          <span class="dona-item-label">Efectivo</span>
          <span class="dona-item-valor mono">${formatearMoneda(totales.efectivo)}</span>
          <span class="dona-item-pct mono">${formatearPorcentaje(totales.pctEfectivo)}</span>
        </div>
        <div class="dona-item">
          <span class="dona-dot" style="background:${COLOR_YAPE}"></span>
          <span class="dona-item-label">Yape</span>
          <span class="dona-item-valor mono">${formatearMoneda(totales.yape)}</span>
          <span class="dona-item-pct mono">${formatearPorcentaje(totales.pctYape)}</span>
        </div>
      </div>`;

    contenedor.innerHTML = svg + leyenda;

    contenedor.querySelectorAll('.dona-segmento').forEach((segmento) => {
      const metodo = segmento.getAttribute('data-metodo');
      const monto = metodo === 'Efectivo' ? totales.efectivo : totales.yape;
      const porcentaje = metodo === 'Efectivo' ? totales.pctEfectivo : totales.pctYape;
      segmento.addEventListener('mouseenter', (evento) => {
        mostrarTooltip(evento, `<strong>${metodo}</strong><br>${formatearMoneda(monto)} · ${formatearPorcentaje(porcentaje)}`);
      });
      segmento.addEventListener('mousemove', moverTooltip);
      segmento.addEventListener('mouseleave', ocultarTooltip);
    });
  }

  function exportarCsv() {
    if (transacciones.length === 0) return;

    const totales = calcularTotales(transacciones);
    const filas = [['Fecha', 'Placa', 'Tipo', 'Método', 'Monto']];
    const ordenadas = transacciones.slice().sort((a, b) => a.fecha - b.fecha);

    ordenadas.forEach((item) => {
      filas.push([
        formatearFechaHora(item.fecha),
        item.placa,
        item.tipo,
        item.metodo,
        formatearMoneda(item.monto)
      ]);
    });

    filas.push(['TOTAL RECAUDADO', '', '', '', formatearMoneda(totales.total)]);
    filas.push(['TOTAL EFECTIVO', '', '', '', formatearMoneda(totales.efectivo)]);
    filas.push(['TOTAL YAPE', '', '', '', formatearMoneda(totales.yape)]);
    filas.push(['TOTAL VEHÍCULOS ATENDIDOS', '', '', '', String(totales.vehiculos)]);

    const contenido = `\uFEFF${filas.map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(',')).join('\r\n')}`;
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = modo === 'anual'
      ? `reporte_ingresos_${periodo.anio}.csv`
      : `reporte_ingresos_${periodo.anio}_${String(periodo.mes).padStart(2, '0')}.csv`;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (cardModulo) {
    cardModulo.addEventListener('click', (evento) => {
      evento.preventDefault();
      document.querySelectorAll('.view-section').forEach((seccion) => seccion.classList.remove('active'));
      if (viewEstadisticas) viewEstadisticas.classList.add('active');
      if (selectAnio) selectAnio.value = String(HOY.anio);
      poblarMeses();
      if (modo === 'mensual' && selectMes) {
        selectMes.value = String(HOY.mes);
      }
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
