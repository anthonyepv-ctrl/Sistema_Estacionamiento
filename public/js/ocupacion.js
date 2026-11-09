document.addEventListener('DOMContentLoaded', () => {
  const cardModulo = document.getElementById('card-modulo-ocupacion');
  const btnBack = document.getElementById('btn-back-to-menu-ocupacion');
  const viewOcupacion = document.getElementById('view-ocupacion');
  const viewDashboard = document.getElementById('view-dashboard');

  const inputInicio = document.getElementById('ocupacion-fecha-inicio');
  const inputFin = document.getElementById('ocupacion-fecha-fin');
  const btnConsultar = document.getElementById('btn-consultar-ocupacion');
  const btnExportar = document.getElementById('btn-exportar-ocupacion');
  const btnImprimir = document.getElementById('btn-imprimir-ocupacion');
  const errorPeriodo = document.getElementById('error-ocupacion');

  const totalVehiculos = document.getElementById('ocupacion-total-vehiculos');
  const totalAutos = document.getElementById('ocupacion-total-autos');
  const totalMotos = document.getElementById('ocupacion-total-motos');
  const porcentajeAutos = document.getElementById('ocupacion-pct-autos');
  const porcentajeMotos = document.getElementById('ocupacion-pct-motos');
  const aforoMaximo = document.getElementById('ocupacion-aforo-maximo');
  const cardAforo = document.getElementById('ocupacion-card-aforo');

  const chartCard = document.getElementById('ocupacion-chart-card');
  const chartContenedor = document.getElementById('ocupacion-chart');
  const estadoVacio = document.getElementById('ocupacion-vacio');
  const tooltip = document.getElementById('ocupacion-tooltip');

  let datos = null;
  let periodoConsultado = null;

  function obtenerHoyPeru() {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
  }

  function obtenerToken() {
    try {
      const crudo = sessionStorage.getItem('cochera_sesion');
      if (!crudo) return null;
      const sesion = JSON.parse(crudo);
      return sesion && sesion.token ? sesion.token : null;
    } catch (e) {
      return null;
    }
  }

  function restarDias(fechaISO, dias) {
    const [anio, mes, dia] = fechaISO.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    fecha.setUTCDate(fecha.getUTCDate() - dias);
    return fecha.toISOString().slice(0, 10);
  }

  function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-PE');
  }

  function formatearPorcentaje(valor) {
    return `${Number(valor || 0).toFixed(1)}%`;
  }

  function aplicarFechasPorDefecto() {
    if (!inputInicio || !inputFin) return;

    const hoy = obtenerHoyPeru();
    inputInicio.max = hoy;
    inputFin.max = hoy;
    inputInicio.value = restarDias(hoy, 6);
    inputFin.value = hoy;
  }

  function mostrarError(mensaje) {
    if (!errorPeriodo) return;
    errorPeriodo.textContent = mensaje;
    errorPeriodo.style.display = 'block';
  }

  function ocultarError() {
    if (errorPeriodo) errorPeriodo.style.display = 'none';
  }

  function validarFechas() {
    if (!inputInicio || !inputFin) return null;

    const inicio = inputInicio.value;
    const fin = inputFin.value;
    const hoy = obtenerHoyPeru();

    if (!inicio || !fin) {
      mostrarError('Seleccione la fecha de inicio y la fecha de fin.');
      return null;
    }

    if (inicio > fin) {
      mostrarError('La fecha de inicio no puede ser posterior a la fecha de fin');
      return null;
    }

    if (inicio > hoy || fin > hoy) {
      mostrarError('No se pueden consultar reportes de fechas futuras');
      return null;
    }

    ocultarError();
    return { inicio, fin };
  }

  async function consultar() {
    const rango = validarFechas();
    if (!rango) return;

    if (btnConsultar) {
      btnConsultar.disabled = true;
      btnConsultar.textContent = 'Consultando...';
    }

    try {
      const parametros = new URLSearchParams({
        fechaInicio: rango.inicio,
        fechaFin: rango.fin
      });
      const token = obtenerToken();
      const respuesta = await fetch(`/api/ocupacion?${parametros.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (respuesta.status === 401) {
        sessionStorage.removeItem('cochera_sesion');
        window.location.reload();
        return;
      }

      const data = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        throw new Error(data.error || 'No se pudo consultar el nivel de ocupación.');
      }

      datos = data;
      periodoConsultado = rango;
      ocultarError();
    } catch (error) {
      datos = null;
      periodoConsultado = null;
      mostrarError(error.message);
    } finally {
      if (btnConsultar) {
        btnConsultar.disabled = false;
        btnConsultar.textContent = 'Consultar';
      }
      renderizar();
    }
  }

  function actualizarNivelAforo(resumen) {
    if (!cardAforo) return;

    cardAforo.classList.remove('nivel-optimo', 'nivel-alto', 'nivel-lleno');

    if (!resumen || resumen.aforoMaximoSimultaneo <= 0 || resumen.capacidadTotalCochera <= 0) {
      return;
    }

    const porcentaje = (resumen.aforoMaximoSimultaneo / resumen.capacidadTotalCochera) * 100;

    if (porcentaje >= 100) {
      cardAforo.classList.add('nivel-lleno');
    } else if (porcentaje >= 80) {
      cardAforo.classList.add('nivel-alto');
    } else {
      cardAforo.classList.add('nivel-optimo');
    }
  }

  function renderizar() {
    const resumen = datos && datos.resumen
      ? datos.resumen
      : {
        totalVehiculos: 0,
        totalAutos: 0,
        totalMotos: 0,
        aforoMaximoSimultaneo: 0,
        capacidadTotalCochera: 0
      };

    const total = Number(resumen.totalVehiculos) || 0;
    const autos = Number(resumen.totalAutos) || 0;
    const motos = Number(resumen.totalMotos) || 0;
    const aforo = Number(resumen.aforoMaximoSimultaneo) || 0;
    const capacidad = Number(resumen.capacidadTotalCochera) || 0;
    const porcentajeAforo = capacidad > 0 ? Math.round((aforo / capacidad) * 100) : 0;

    if (totalVehiculos) totalVehiculos.textContent = formatearNumero(total);
    if (totalAutos) totalAutos.textContent = formatearNumero(autos);
    if (totalMotos) totalMotos.textContent = formatearNumero(motos);
    if (porcentajeAutos) porcentajeAutos.textContent = `${formatearPorcentaje(total > 0 ? (autos / total) * 100 : 0)} del total`;
    if (porcentajeMotos) porcentajeMotos.textContent = `${formatearPorcentaje(total > 0 ? (motos / total) * 100 : 0)} del total`;
    if (aforoMaximo) aforoMaximo.textContent = `${formatearNumero(aforo)} veh. (${porcentajeAforo}%)`;

    actualizarNivelAforo(datos ? resumen : null);

    if (!datos) {
      if (chartCard) chartCard.style.display = 'none';
      if (estadoVacio) estadoVacio.style.display = 'none';
      if (chartContenedor) chartContenedor.innerHTML = '';
      if (btnExportar) {
        btnExportar.disabled = true;
        btnExportar.title = 'No hay datos disponibles para exportar';
        btnExportar.classList.add('export-deshabilitado');
      }
      if (btnImprimir) btnImprimir.disabled = true;
      return;
    }

    if (btnImprimir) btnImprimir.disabled = false;

    if (datos.sinDatos) {
      if (chartCard) chartCard.style.display = 'none';
      if (estadoVacio) estadoVacio.style.display = '';
      if (chartContenedor) chartContenedor.innerHTML = '';
      if (btnExportar) {
        btnExportar.disabled = true;
        btnExportar.title = 'No hay datos disponibles para exportar';
        btnExportar.classList.add('export-deshabilitado');
      }
      return;
    }

    if (chartCard) chartCard.style.display = '';
    if (estadoVacio) estadoVacio.style.display = 'none';
    if (btnExportar) {
      btnExportar.disabled = false;
      btnExportar.title = 'Exportar a CSV/Excel';
      btnExportar.classList.remove('export-deshabilitado');
    }

    dibujarGrafico(datos.bloquesHorarios || []);
  }

  function elegirPaso(maximo) {
    const pasos = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
    return pasos.find((paso) => paso * 4 >= maximo) || Math.ceil(maximo / 400) * 100;
  }

  function mostrarTooltip(evento, contenido) {
    if (!tooltip) return;
    tooltip.innerHTML = contenido;
    tooltip.style.display = 'block';
    moverTooltip(evento);
  }

  function moverTooltip(evento) {
    if (!tooltip) return;

    const izquierda = Math.min(evento.clientX + 14, window.innerWidth - 250);
    const arriba = Math.max(8, evento.clientY - 38);

    tooltip.style.left = `${izquierda}px`;
    tooltip.style.top = `${arriba}px`;
  }

  function ocultarTooltip() {
    if (tooltip) tooltip.style.display = 'none';
  }

  function dibujarGrafico(bloques) {
    if (!chartContenedor) return;

    if (!Array.isArray(bloques) || bloques.length === 0) {
      chartContenedor.innerHTML = '';
      return;
    }

    const ancho = 760;
    const alto = 300;
    const margenIzquierdo = 52;
    const margenDerecho = 14;
    const margenSuperior = 34;
    const margenInferior = 46;
    const anchoUtil = ancho - margenIzquierdo - margenDerecho;
    const altoUtil = alto - margenSuperior - margenInferior;
    const valores = bloques.map((item) => Number(item.cantidad) || 0);
    const maximo = Math.max(0, ...valores);
    const paso = elegirPaso(maximo);
    const maximoEje = paso * 4;
    const anchoBarra = anchoUtil / bloques.length;

    let svg = `<svg viewBox="0 0 ${ancho} ${alto}" class="chart-svg" role="img" aria-label="Afluencia por bloques horarios">`;

    for (let indice = 0; indice <= 4; indice += 1) {
      const valor = (maximoEje / 4) * indice;
      const y = margenSuperior + altoUtil - (valor / maximoEje) * altoUtil;
      svg += `<line x1="${margenIzquierdo}" y1="${y}" x2="${ancho - margenDerecho}" y2="${y}" class="chart-grid-line" />`;
      svg += `<text x="${margenIzquierdo - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-label mono">${Math.round(valor)}</text>`;
    }

    bloques.forEach((item, indice) => {
      const valor = Number(item.cantidad) || 0;
      const altura = maximoEje > 0 ? (valor / maximoEje) * altoUtil : 0;
      const x = margenIzquierdo + indice * anchoBarra + anchoBarra * 0.18;
      const y = margenSuperior + altoUtil - altura;
      const clase = item.esPico ? 'chart-bar chart-bar-pico' : 'chart-bar';

      svg += `<rect class="${clase}" data-idx="${indice}" x="${x}" y="${y}" width="${anchoBarra * 0.64}" height="${Math.max(altura, 0)}" rx="2" />`;

      if (item.esPico && valor > 0) {
        svg += `<text x="${x + (anchoBarra * 0.64) / 2}" y="${Math.max(y - 8, 12)}" text-anchor="middle" class="chart-peak-label">Hora pico</text>`;
      }
    });

    bloques.forEach((item, indice) => {
      const x = margenIzquierdo + indice * anchoBarra + anchoBarra / 2;
      svg += `<text x="${x}" y="${alto - 14}" text-anchor="middle" class="chart-axis-label">${item.bloque}</text>`;
    });

    svg += '</svg>';
    chartContenedor.innerHTML = svg;

    chartContenedor.querySelectorAll('.chart-bar').forEach((barra) => {
      const indice = Number(barra.getAttribute('data-idx'));
      const item = bloques[indice];
      const cantidad = Number(item.cantidad) || 0;
      const porcentaje = Number(item.porcentaje) || 0;
      const texto = `<strong>${item.bloque}</strong><br>${cantidad} ${cantidad === 1 ? 'vehículo' : 'vehículos'} · ${porcentaje.toFixed(1)}%`;

      barra.addEventListener('mouseenter', (evento) => mostrarTooltip(evento, texto));
      barra.addEventListener('mousemove', moverTooltip);
      barra.addEventListener('mouseleave', ocultarTooltip);
    });
  }

  function exportar() {
    if (!datos || datos.sinDatos || !periodoConsultado) return;

    const token = obtenerToken();
    const parametros = new URLSearchParams({
      fechaInicio: periodoConsultado.inicio,
      fechaFin: periodoConsultado.fin,
      formato: 'csv'
    });
    if (token) parametros.set('token', token);
    const enlace = document.createElement('a');

    enlace.href = `/api/ocupacion/exportar?${parametros.toString()}`;
    enlace.download = '';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  }

  if (cardModulo) {
    cardModulo.addEventListener('click', (evento) => {
      evento.preventDefault();
      document.querySelectorAll('.view-section').forEach((seccion) => seccion.classList.remove('active'));
      if (viewOcupacion) viewOcupacion.classList.add('active');
      aplicarFechasPorDefecto();
      consultar();
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', (evento) => {
      evento.preventDefault();
      if (viewOcupacion) viewOcupacion.classList.remove('active');
      if (viewDashboard) viewDashboard.classList.add('active');
    });
  }

  if (btnConsultar) {
    btnConsultar.addEventListener('click', consultar);
  }

  if (btnExportar) {
    btnExportar.addEventListener('click', exportar);
  }

  if (btnImprimir) {
    btnImprimir.addEventListener('click', () => window.print());
  }

  [inputInicio, inputFin].forEach((input) => {
    if (!input) return;

    input.addEventListener('input', ocultarError);
    input.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        consultar();
      }
    });
  });

  aplicarFechasPorDefecto();
  renderizar();
});
