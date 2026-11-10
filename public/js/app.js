/**
 * Sistema de Gestión de Cochera — Lógica de Interfaz conectada a la API (UPAO-34)
 */

document.addEventListener('DOMContentLoaded', () => {
  let tarifas = [];
  let rolActual = '';

  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewTarifas = document.getElementById('view-tarifas');
  const viewIngreso = document.getElementById('view-ingreso');
  const viewSalida = document.getElementById('view-salida');
  const headerUserSection = document.getElementById('header-user-section');
  const toastContainer = document.getElementById('toast-container');
  const sessionUserName = document.getElementById('session-user-name');
  const sessionUserRole = document.getElementById('session-user-role');
  const sessionUserBadge = document.getElementById('session-user-badge');

  function mostrarPantalla(nombre) {
    if (nombre !== 'disponibilidad' && window.disponibilidadModulo && typeof window.disponibilidadModulo.detener === 'function') {
      window.disponibilidadModulo.detener();
    }

    document.querySelectorAll('.view-section').forEach((section) => {
      section.classList.remove('active');
    });

    if (nombre === 'login') {
      viewLogin.classList.add('active');
      headerUserSection.style.display = 'none';
      const userInput = document.getElementById('login-usuario');
      if (userInput) userInput.focus();
    } else if (nombre === 'dashboard') {
      viewDashboard.classList.add('active');
      headerUserSection.style.display = 'flex';
      aplicarMenuPorRol(rolActual);
    } else if (nombre === 'tarifas') {
      viewTarifas.classList.add('active');
      headerUserSection.style.display = 'flex';
      const inputHora = document.getElementById('input-precio-hora');
      if (inputHora) inputHora.focus();
    } else if (nombre === 'ingreso') {
      viewIngreso.classList.add('active');
      headerUserSection.style.display = 'flex';
      const inputPlaca = document.getElementById('input-placa');
      if (inputPlaca) inputPlaca.focus();
    } else if (nombre === 'salida') {
      viewSalida.classList.add('active');
      headerUserSection.style.display = 'flex';
      const inputBuscar = document.getElementById('input-buscar-placa');
      if (inputBuscar) inputBuscar.focus();
    } else if (nombre === 'reportes') {
      const viewReportes = document.getElementById('view-reportes');
      if (viewReportes) viewReportes.classList.add('active');
      headerUserSection.style.display = 'flex';
    } else if (nombre === 'disponibilidad') {
      const viewDisponibilidad = document.getElementById('view-disponibilidad');
      if (viewDisponibilidad) viewDisponibilidad.classList.add('active');
      headerUserSection.style.display = rolActual ? 'flex' : 'none';
      if (window.disponibilidadModulo && typeof window.disponibilidadModulo.iniciar === 'function') {
        window.disponibilidadModulo.iniciar();
      }
    }
  }

  function aplicarMenuPorRol(rol) {
    const esDueno = rol === 'DUENO' || rol === 'DUEÑO';
    const esRecepcionista = rol === 'RECEPCIONISTA';

    const cardTarifas = document.getElementById('card-modulo-tarifas');
    const cardIngreso = document.getElementById('card-modulo-ingreso');
    const cardSalida = document.getElementById('card-modulo-salida');
    const cardAforo = document.getElementById('card-modulo-aforo');
    const cardReportes = document.getElementById('card-modulo-reportes');
    const cardEstadisticas = document.getElementById('card-modulo-estadisticas');
    const cardOcupacion = document.getElementById('card-modulo-ocupacion');

    if (cardTarifas) cardTarifas.style.display = esDueno ? '' : 'none';
    if (cardIngreso) cardIngreso.style.display = esRecepcionista ? '' : 'none';
    if (cardSalida) cardSalida.style.display = esRecepcionista ? '' : 'none';
    if (cardAforo) cardAforo.style.display = (esDueno || esRecepcionista) ? '' : 'none';
    if (cardReportes) cardReportes.style.display = esDueno ? '' : 'none';
    if (cardEstadisticas) cardEstadisticas.style.display = esDueno ? '' : 'none';
    if (cardOcupacion) cardOcupacion.style.display = esDueno ? '' : 'none';
    const cardDisponibilidad = document.getElementById('card-modulo-disponibilidad');
    if (cardDisponibilidad) cardDisponibilidad.style.display = '';
  }

  function mostrarToast(mensaje, esError = false) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${esError ? 'toast-error' : ''}`;
    toast.textContent = mensaje;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3800);
  }

  const CLAVE_SESION = 'cochera_sesion';

  function leerSesionGuardada() {
    try {
      const crudo = sessionStorage.getItem(CLAVE_SESION);
      if (!crudo) return null;
      const sesion = JSON.parse(crudo);
      return sesion && sesion.token ? sesion : null;
    } catch (error) {
      return null;
    }
  }

  function guardarSesion(sesion) {
    if (!sesion || !sesion.token) return;
    try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion)); } catch (error) { /* modo privado */ }
  }

  function olvidarSesion() {
    try { sessionStorage.removeItem(CLAVE_SESION); } catch (error) { /* modo privado */ }
  }

  async function pedirApi(url, opciones = {}) {
    let respuesta;

    const sesion = leerSesionGuardada();
    const cabeceras = {
      'Content-Type': 'application/json',
      ...(sesion && sesion.token ? { Authorization: `Bearer ${sesion.token}` } : {})
    };

    try {
      respuesta = await fetch(url, {
        ...opciones,
        headers: { ...cabeceras, ...(opciones.headers || {}) }
      });
    } catch (error) {
      throw new Error('No se pudo conectar con el servidor. Verifica que esté corriendo (npm run dev).');
    }

    // Sesión vencida o token inválido: se limpia y se vuelve al login.
    if (respuesta.status === 401) {
      olvidarSesion();
      window.sesionActual = null;
      rolActual = '';
      if (sessionUserName) sessionUserName.textContent = '';
      if (sessionUserRole) sessionUserRole.textContent = '';
      if (sessionUserBadge) sessionUserBadge.textContent = '';
      mostrarPantalla('login');
      mostrarToast('Su sesión expiró. Vuelva a iniciar sesión.', true);
      throw new Error('Sesión expirada.');
    }

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(datos.error || 'La API no respondió correctamente. Abre la aplicación en http://localhost:3000.');
    }

    return datos;
  }

  const formLogin = document.getElementById('form-login');
  const inputUsuario = document.getElementById('login-usuario');
  const inputPassword = document.getElementById('login-password');
  const btnTogglePassword = document.getElementById('btn-toggle-password');
  const btnLoginSubmit = document.getElementById('btn-login-submit');

  if (btnTogglePassword && inputPassword) {
    btnTogglePassword.addEventListener('click', () => {
      const esPassword = inputPassword.type === 'password';
      inputPassword.type = esPassword ? 'text' : 'password';
      btnTogglePassword.textContent = esPassword ? 'Ocultar' : 'Mostrar';
    });
  }

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const usuario = inputUsuario.value.trim();
      const password = inputPassword.value.trim();

      if (!usuario) {
        mostrarErrorCampo(inputUsuario, 'Ingrese su usuario.');
        return;
      }
      if (!password) {
        mostrarErrorCampo(inputPassword, 'Ingrese su contraseña.');
        return;
      }

      btnLoginSubmit.classList.add('loading');
      btnLoginSubmit.disabled = true;

      try {
        const sesion = await pedirApi('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ usuario, contrasena: password })
        });

        rolActual = sesion.rol;
        window.sesionActual = { usuario: sesion.usuario, nombre: sesion.nombre, rol: sesion.rol };
        guardarSesion({
          token: sesion.token,
          usuario: sesion.usuario,
          nombre: sesion.nombre,
          rol: sesion.rol
        });

        if (sessionUserName) sessionUserName.textContent = sesion.nombre;
        if (sessionUserRole) sessionUserRole.textContent = sesion.rol;
        if (sessionUserBadge) sessionUserBadge.textContent = sesion.rol;

        mostrarPantalla('dashboard');
      } catch (error) {
        mostrarToast(error.message, true);
      } finally {
        btnLoginSubmit.classList.remove('loading');
        btnLoginSubmit.disabled = false;
      }
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      rolActual = '';
      window.sesionActual = null;
      olvidarSesion();
      if (sessionUserName) sessionUserName.textContent = '';
      if (sessionUserRole) sessionUserRole.textContent = '';
      if (sessionUserBadge) sessionUserBadge.textContent = '';
      if (window.location.hash) {
        window.location.hash = '';
      }
      mostrarPantalla('disponibilidad');
    });
  }

  const cardModuloTarifas = document.getElementById('card-modulo-tarifas');
  if (cardModuloTarifas) {
    cardModuloTarifas.addEventListener('click', async () => {
      mostrarPantalla('tarifas');

      try {
        await cargarTarifas();
        if (tarifas.length > 0) {
          cargarTarifaEnFormulario(tarifas[0].id);
        }
      } catch (error) {
        mostrarToast(error.message, true);
      }
    });
  }

  const btnBackToMenu = document.getElementById('btn-back-to-menu');
  if (btnBackToMenu) {
    btnBackToMenu.addEventListener('click', () => {
      mostrarPantalla('dashboard');
    });
  }

  const tablaBody = document.getElementById('tabla-tarifas-body');
  const formTarifa = document.getElementById('form-modificar-tarifa');
  const selectTipo = document.getElementById('select-tipo-tarifa');
  const inputPrecioHora = document.getElementById('input-precio-hora');
  const inputPrecioFraccion = document.getElementById('input-precio-fraccion');
  const btnGuardarTarifa = document.getElementById('btn-guardar-tarifa');
  const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
  const formTitle = document.getElementById('form-tarifa-title');

  async function cargarTarifas() {
    tarifas = await pedirApi('/api/tarifas');
    renderSelectTipos();
    renderTablaTarifas();
  }

  function renderSelectTipos() {
    if (!selectTipo) return;

    selectTipo.innerHTML = tarifas
      .map((tarifa) => `<option value="${tarifa.id}">${tarifa.tipo}</option>`)
      .join('');
  }

  function renderTablaTarifas() {
    if (!tablaBody) return;

    tablaBody.innerHTML = tarifas.map((item) => `
      <tr>
        <td style="font-weight: 500;">${item.tipo}</td>
        <td class="mono" style="font-weight: 700; color: var(--primary);">S/ ${item.precioHora.toFixed(2)}</td>
        <td class="mono" style="font-weight: 600;">S/ ${item.precioFraccion.toFixed(2)}</td>
        <td><span class="badge ${item.estado ? 'badge-success' : 'badge-danger'}">${item.estado ? 'ACTIVA' : 'INACTIVA'}</span></td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm btn-editar-fila" data-id="${item.id}">
            Modificar
          </button>
        </td>
      </tr>
    `).join('');

    tablaBody.querySelectorAll('.btn-editar-fila').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        cargarTarifaEnFormulario(e.currentTarget.getAttribute('data-id'));
      });
    });
  }

  function cargarTarifaEnFormulario(id) {
    const tarifa = tarifas.find((t) => String(t.id) === String(id));
    if (!tarifa) return;

    selectTipo.value = tarifa.id;
    inputPrecioHora.value = tarifa.precioHora.toFixed(2);
    inputPrecioFraccion.value = tarifa.precioFraccion.toFixed(2);
    formTitle.textContent = `Modificar Tarifa: ${tarifa.tipo}`;

    limpiarErrores(inputPrecioHora);
    limpiarErrores(inputPrecioFraccion);
    inputPrecioHora.focus();
  }

  if (selectTipo) {
    selectTipo.addEventListener('change', (e) => {
      cargarTarifaEnFormulario(e.target.value);
    });
  }

  if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener('click', () => {
      cargarTarifaEnFormulario(selectTipo.value);
    });
  }

  function validarMonto(input) {
    const val = input.value.trim();
    const regex = /^\d+(\.\d{1,2})?$/;
    const num = parseFloat(val);

    if (!val || !regex.test(val) || isNaN(num) || num < 0.01 || num > 999.99) {
      mostrarErrorCampo(input, 'Ingrese un monto válido mayor a 0.00 (ej. 4.50).');
      return false;
    }

    limpiarErrores(input);
    return true;
  }

  function mostrarErrorCampo(input, mensaje) {
    input.classList.add('error');
    const feedback = input.closest('.form-group')?.querySelector('.input-feedback');
    if (feedback) {
      feedback.textContent = mensaje;
      feedback.classList.add('visible');
    }
  }

  function limpiarErrores(input) {
    input.classList.remove('error');
    const feedback = input.closest('.form-group')?.querySelector('.input-feedback');
    if (feedback) {
      feedback.textContent = '';
      feedback.classList.remove('visible');
    }
  }

  inputPrecioHora?.addEventListener('input', () => validarMonto(inputPrecioHora));
  inputPrecioFraccion?.addEventListener('input', () => validarMonto(inputPrecioFraccion));

  if (formTarifa) {
    formTarifa.addEventListener('submit', async (e) => {
      e.preventDefault();

      const esHoraValida = validarMonto(inputPrecioHora);
      const esFraccionValida = validarMonto(inputPrecioFraccion);

      if (!esHoraValida || !esFraccionValida) {
        return;
      }

      btnGuardarTarifa.classList.add('loading');
      btnGuardarTarifa.disabled = true;

      try {
        await pedirApi(`/api/tarifas/${selectTipo.value}`, {
          method: 'PUT',
          body: JSON.stringify({
            precioHora: inputPrecioHora.value.trim(),
            precioFraccion: inputPrecioFraccion.value.trim()
          })
        });

        await cargarTarifas();
        cargarTarifaEnFormulario(selectTipo.value);

        mostrarToast('Tarifa actualizada correctamente');
      } catch (error) {
        mostrarToast(error.message, true);
      } finally {
        btnGuardarTarifa.classList.remove('loading');
        btnGuardarTarifa.disabled = false;
      }
    });
  }

  const cardModuloIngreso = document.getElementById('card-modulo-ingreso');
  const btnBackToMenuIngreso = document.getElementById('btn-back-to-menu-ingreso');
  const formIngreso = document.getElementById('form-registrar-ingreso');
  const inputPlaca = document.getElementById('input-placa');
  const selectTipoIngreso = document.getElementById('select-tipo-ingreso');
  const btnLimpiarIngreso = document.getElementById('btn-limpiar-ingreso');
  const btnRegistrarIngreso = document.getElementById('btn-registrar-ingreso');
  const previewPlaca = document.getElementById('preview-placa');
  const previewTipo = document.getElementById('preview-tipo');
  const inputNotaIngreso = document.getElementById('input-nota-ingreso');
  const contadorNota = document.getElementById('contador-nota');

  function actualizarContadorNota() {
    if (!inputNotaIngreso || !contadorNota) return;
    const largo = inputNotaIngreso.value.length;
    contadorNota.textContent = `${largo}/250`;
    contadorNota.classList.toggle('limite', largo >= 250);
  }

  if (inputNotaIngreso) {
    inputNotaIngreso.addEventListener('input', actualizarContadorNota);
  }

  const PLACA_REGEX = {
    auto: /^[A-Z][A-Z0-9]{2}-?\d{3}$/,
    moto: /^(\d{4}-?[A-Z0-9]{2}|[A-Z]{2}-?\d{4}|[A-Z]{3}-?\d{4})$/
  };

  const ETIQUETA_TIPO = {
    auto: 'Automóvil',
    moto: 'Motocicleta'
  };

  function analizarPlaca(limpio) {
    if (limpio.length >= 7) {
      return { tipo: 'moto', corte: 3 };
    }

    if (/^\d/.test(limpio)) {
      return { tipo: 'moto', corte: 4 };
    }

    if (limpio.length === 6 && /\d{4}$/.test(limpio)) {
      return { tipo: 'moto', corte: 2 };
    }

    if (limpio.length === 6) {
      if (/^[A-Z][A-Z0-9]{2}\d{3}$/.test(limpio)) {
        return { tipo: 'auto', corte: 3 };
      }
      return { tipo: null, corte: 3 };
    }

    return { tipo: 'auto', corte: 3 };
  }

  function normalizarPlaca(valor) {
    const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpio.length === 0) return '';

    const { corte } = analizarPlaca(limpio);
    if (limpio.length <= corte) return limpio;

    const maxLen = limpio.length >= 7 ? 7 : 6;
    return `${limpio.slice(0, corte)}-${limpio.slice(corte, maxLen)}`;
  }

  function inferirTipo(placa) {
    const limpio = placa.replace(/[^A-Z0-9]/g, '');
    return analizarPlaca(limpio).tipo;
  }

  function actualizarVistaPrevia() {
    if (previewPlaca) previewPlaca.textContent = inputPlaca.value.trim() || '—';
    if (previewTipo) previewTipo.textContent = ETIQUETA_TIPO[selectTipoIngreso.value] || '—';
  }

  function validarPlaca(mostrarMensaje) {
    const valor = inputPlaca.value.trim();
    const tipo = selectTipoIngreso.value;

    if (!valor) {
      if (mostrarMensaje) mostrarErrorCampo(inputPlaca, 'Ingrese la placa del vehículo.');
      return false;
    }

    const alfanumerico = valor.replace(/[^A-Z0-9]/g, '');
    if (alfanumerico.length >= 6) {
      const tipoInferido = inferirTipo(valor);
      if (tipoInferido && tipo !== tipoInferido) {
        if (mostrarMensaje) {
          const esperado = ETIQUETA_TIPO[tipoInferido];
          const seleccionado = ETIQUETA_TIPO[tipo];
          mostrarErrorCampo(
            inputPlaca,
            `Incoherencia: La placa ${valor} corresponde a ${esperado} según norma MTC, no puede registrarse como ${seleccionado}.`
          );
        }
        return false;
      }
    }

    if (!PLACA_REGEX[tipo].test(valor)) {
      if (mostrarMensaje) {
        mostrarErrorCampo(inputPlaca, 'Ingrese una placa válida según el formato peruano (ej. ABC-123 o 1234-5A).');
      }
      return false;
    }

    limpiarErrores(inputPlaca);
    return true;
  }

  function limpiarFormularioIngreso() {
    inputPlaca.value = '';
    selectTipoIngreso.value = 'auto';
    if (inputNotaIngreso) inputNotaIngreso.value = '';
    actualizarContadorNota();
    limpiarErrores(inputPlaca);
    actualizarVistaPrevia();
    inputPlaca.focus();
  }

  if (cardModuloIngreso) {
    cardModuloIngreso.addEventListener('click', () => {
      mostrarPantalla('ingreso');
      limpiarFormularioIngreso();
    });
  }

  if (btnBackToMenuIngreso) {
    btnBackToMenuIngreso.addEventListener('click', () => {
      mostrarPantalla('dashboard');
    });
  }

  if (inputPlaca) {
    // Bloqueo instantáneo de la tecla espacio y atajo con ENTER
    inputPlaca.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (formIngreso) formIngreso.requestSubmit();
      }
    });

    inputPlaca.addEventListener('input', () => {
      const sinEspacios = inputPlaca.value.replace(/\s+/g, '');
      inputPlaca.value = normalizarPlaca(sinEspacios);
      const tipoInferido = inferirTipo(inputPlaca.value);
      if (tipoInferido) {
        selectTipoIngreso.value = tipoInferido;
      }
      actualizarVistaPrevia();

      const alfanumerico = inputPlaca.value.replace(/[^A-Z0-9]/g, '');
      if (alfanumerico.length === 0) {
        mostrarErrorCampo(inputPlaca, 'Ingrese la placa del vehículo.');
      } else if (alfanumerico.length >= 6) {
        validarPlaca(true);
      } else {
        limpiarErrores(inputPlaca);
      }
    });

    inputPlaca.addEventListener('blur', () => {
      validarPlaca(true);
    });
  }

  if (selectTipoIngreso) {
    selectTipoIngreso.addEventListener('change', () => {
      actualizarVistaPrevia();
      if (inputPlaca.value.trim()) validarPlaca(true);
    });
  }

  if (btnLimpiarIngreso) {
    btnLimpiarIngreso.addEventListener('click', limpiarFormularioIngreso);
  }

  if (formIngreso) {
    formIngreso.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validarPlaca(true)) {
        inputPlaca.focus();
        return;
      }

      const placa = inputPlaca.value.trim();
      const tipo = selectTipoIngreso.value;
      const notaValor = inputNotaIngreso ? inputNotaIngreso.value.trim() : '';

      const datosIngreso = {
        placa,
        tipo,
        nota: notaValor.length > 0 ? notaValor : null
      };

      if (btnRegistrarIngreso) {
        btnRegistrarIngreso.classList.add('loading');
        btnRegistrarIngreso.disabled = true;
      }

      try {
        const ingreso = await pedirApi('/api/ingresos', {
          method: 'POST',
          body: JSON.stringify(datosIngreso)
        });

        if (notaValor.length > 0) {
          guardarNotaLocal(placa, notaValor);
        } else {
          eliminarNotaLocal(placa);
        }

        mostrarToast(ingreso.mensaje || `Ingreso registrado: Placa [${placa}]`);
        limpiarFormularioIngreso();
      } catch (error) {
        mostrarToast(error.message, true);
      } finally {
        if (btnRegistrarIngreso) {
          btnRegistrarIngreso.classList.remove('loading');
          btnRegistrarIngreso.disabled = false;
        }
      }
    });
  }

  const cardModuloSalida = document.getElementById('card-modulo-salida');
  const btnBackToMenuSalida = document.getElementById('btn-back-to-menu-salida');
  const inputBuscarPlaca = document.getElementById('input-buscar-placa');
  const tablaActivosBody = document.getElementById('tabla-activos-body');
  const listaActivosVacia = document.getElementById('lista-activos-vacia');
  const salidaVacio = document.getElementById('salida-vacio');
  const salidaResumen = document.getElementById('salida-resumen');
  const salidaPlaca = document.getElementById('salida-placa');
  const salidaTipo = document.getElementById('salida-tipo');
  const salidaHoraEntrada = document.getElementById('salida-hora-entrada');
  const salidaTiempo = document.getElementById('salida-tiempo');
  const salidaTarifa = document.getElementById('salida-tarifa');
  const salidaMonto = document.getElementById('salida-monto');
  const selectMetodoPago = document.getElementById('select-metodo-pago');
  const btnRegistrarSalida = document.getElementById('btn-registrar-salida');
  const btnCancelarSalida = document.getElementById('btn-cancelar-salida');
  const salidaNotaContainer = document.getElementById('salida-nota-container');

  let activos = [];
  let tarifasSalida = [];
  let activoSeleccionado = null;

  function formatearHora(fechaISO) {
    const fecha = new Date(fechaISO);
    const hoy = new Date();
    const esHoy = fecha.getFullYear() === hoy.getFullYear()
      && fecha.getMonth() === hoy.getMonth()
      && fecha.getDate() === hoy.getDate();

    const hora = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    if (esHoy) return hora;

    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes} ${hora}`;
  }

  function calcularCobro(horaIngreso) {
    const diffMs = Math.max(0, new Date() - new Date(horaIngreso));
    const horas = Math.floor(diffMs / 3600000);
    const minutos = Math.floor((diffMs % 3600000) / 60000);
    const hayFraccion = diffMs % 3600000 > 0;
    return { horas, minutos, hayFraccion };
  }

  function tarifaDeTipo(tipo) {
    return tarifasSalida.find((t) => t.tipo === tipo);
  }

  function montoDeCobro(tarifa, cobro) {
    return cobro.horas * tarifa.precioHora + (cobro.hayFraccion ? tarifa.precioFraccion : 0);
  }

  async function cargarSalida() {
    try {
      activos = await pedirApi('/api/salidas/activos');
    } catch (_) {
      activos = await pedirApi('/api/ingresos/activos');
    }
    tarifasSalida = await pedirApi('/api/tarifas');
    activoSeleccionado = null;
    if (inputBuscarPlaca) inputBuscarPlaca.value = '';
    renderListaActivos();
    mostrarResumen(null);
  }

  function placasCoinciden(placa, busqueda) {
    const limpia = placa.replace(/[^A-Z0-9]/g, '');
    return limpia.includes(busqueda.replace(/[^A-Z0-9]/g, ''));
  }

  function renderListaActivos() {
    if (!tablaActivosBody) return;

    const busqueda = (inputBuscarPlaca?.value || '').trim().toUpperCase();
    const filtrados = activos.filter((a) => placasCoinciden(a.placa, busqueda));

    tablaActivosBody.innerHTML = filtrados.map((a) => `
      <tr class="fila-activo ${activoSeleccionado && String(activoSeleccionado.id) === String(a.id) ? 'seleccionada' : ''}" data-id="${a.id}">
        <td class="mono" style="font-weight: 700;">${a.placa}</td>
        <td>${a.tipo}</td>
        <td class="mono">${formatearHora(a.horaIngreso)}</td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm btn-seleccionar-activo" data-id="${a.id}">
            Seleccionar
          </button>
        </td>
      </tr>
    `).join('');

    tablaActivosBody.querySelectorAll('.fila-activo').forEach((fila) => {
      fila.addEventListener('click', () => seleccionarActivo(fila.getAttribute('data-id')));
    });

    if (listaActivosVacia) {
      listaActivosVacia.textContent = activos.length > 0
        ? 'Sin resultados para esa placa.'
        : 'No hay vehículos en cochera.';
      listaActivosVacia.style.display = filtrados.length === 0 ? '' : 'none';
    }
  }

  function guardarNotaLocal(placa, nota) {
    try {
      const limpia = String(placa || '').replace(/[^A-Z0-9]/g, '');
      if (!limpia) return;
      if (nota && nota.trim().length > 0) {
        localStorage.setItem(`cochera_nota_${limpia}`, nota.trim());
      } else {
        localStorage.removeItem(`cochera_nota_${limpia}`);
      }
    } catch (_) {}
  }

  function obtenerNotaLocal(placa) {
    try {
      const limpia = String(placa || '').replace(/[^A-Z0-9]/g, '');
      if (!limpia) return '';
      return localStorage.getItem(`cochera_nota_${limpia}`) || '';
    } catch (_) {
      return '';
    }
  }

  function eliminarNotaLocal(placa) {
    try {
      const limpia = String(placa || '').replace(/[^A-Z0-9]/g, '');
      if (limpia) localStorage.removeItem(`cochera_nota_${limpia}`);
    } catch (_) {}
  }

  function renderNotaSalida(activo) {
    if (!salidaNotaContainer) return;

    salidaNotaContainer.innerHTML = '';
    if (!activo) return;

    const notaApi = typeof activo.nota === 'string' ? activo.nota.trim() : '';
    const notaLocal = obtenerNotaLocal(activo.placa);
    const nota = notaApi || notaLocal;

    if (nota.length > 0) {
      const card = document.createElement('div');
      card.className = 'callout-nota callout-nota-alerta';

      const header = document.createElement('div');
      header.className = 'callout-nota-header';

      const titulo = document.createElement('span');
      titulo.className = 'callout-nota-titulo';
      titulo.textContent = 'Observación registrada al ingreso:';

      header.appendChild(titulo);

      const texto = document.createElement('p');
      texto.className = 'callout-nota-texto';
      texto.textContent = nota;

      const meta = document.createElement('div');
      meta.className = 'callout-nota-meta';
      meta.style.fontSize = '11px';
      meta.style.marginTop = '6px';
      meta.style.color = '#92400E';
      meta.style.display = 'flex';
      meta.style.alignItems = 'center';
      meta.style.gap = '6px';
      meta.style.fontWeight = '500';

      const nombreUsuario = activo.usuarioIngreso || 'Recepcionista';
      const idUsuario = activo.idUsuarioIngreso || activo.idUsuario || 2;
      const horaTexto = formatearHora(activo.horaIngreso);

      meta.innerHTML = `<span aria-hidden="true">👤</span> Registrado por: <strong>${nombreUsuario}</strong> (ID: #${idUsuario}) · ${horaTexto}`;

      card.appendChild(header);
      card.appendChild(texto);
      card.appendChild(meta);
      salidaNotaContainer.appendChild(card);
    } else {
      const neutro = document.createElement('div');
      neutro.className = 'callout-nota-neutro';

      const texto = document.createElement('span');
      texto.className = 'callout-nota-texto-neutro';
      texto.textContent = 'Sin observaciones registradas';

      neutro.appendChild(texto);
      salidaNotaContainer.appendChild(neutro);
    }
  }

  function mostrarResumen(activo) {
    if (!salidaResumen || !salidaVacio) return;

    if (!activo) {
      salidaResumen.style.display = 'none';
      salidaVacio.style.display = '';
      if (salidaNotaContainer) salidaNotaContainer.innerHTML = '';
      return;
    }

    const cobro = calcularCobro(activo.horaIngreso);
    const tarifa = tarifaDeTipo(activo.tipo);

    salidaPlaca.textContent = activo.placa;
    salidaTipo.textContent = activo.tipo;
    salidaHoraEntrada.textContent = formatearHora(activo.horaIngreso);
    salidaTiempo.textContent = `${cobro.horas} h ${cobro.minutos} min`;

    renderNotaSalida(activo);

    if (tarifa) {
      salidaTarifa.textContent = `S/ ${tarifa.precioHora.toFixed(2)} /h + S/ ${tarifa.precioFraccion.toFixed(2)} fracción`;
      salidaMonto.textContent = `S/ ${montoDeCobro(tarifa, cobro).toFixed(2)}`;
    } else {
      salidaTarifa.textContent = 'Sin tarifa vigente';
      salidaMonto.textContent = 'S/ —';
    }

    salidaVacio.style.display = 'none';
    salidaResumen.style.display = '';
    if (selectMetodoPago) selectMetodoPago.focus();
  }

  function seleccionarActivo(id) {
    const activo = activos.find((a) => String(a.id) === String(id));
    if (!activo) return;

    activoSeleccionado = activo;

    tablaActivosBody?.querySelectorAll('.fila-activo').forEach((fila) => {
      fila.classList.toggle('seleccionada', fila.getAttribute('data-id') === String(id));
    });

    mostrarResumen(activo);
  }

  function limpiarSalida() {
    activoSeleccionado = null;
    if (inputBuscarPlaca) inputBuscarPlaca.value = '';
    renderListaActivos();
    mostrarResumen(null);
    if (inputBuscarPlaca) inputBuscarPlaca.focus();
  }

  if (cardModuloSalida) {
    cardModuloSalida.addEventListener('click', async () => {
      mostrarPantalla('salida');

      try {
        await cargarSalida();
      } catch (error) {
        mostrarToast(error.message, true);
      }
    });
  }

  if (btnBackToMenuSalida) {
    btnBackToMenuSalida.addEventListener('click', () => {
      mostrarPantalla('dashboard');
    });
  }

  if (inputBuscarPlaca) {
    inputBuscarPlaca.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const primera = tablaActivosBody?.querySelector('.fila-activo');
        if (primera) seleccionarActivo(primera.getAttribute('data-id'));
      }
    });

    inputBuscarPlaca.addEventListener('input', () => {
      inputBuscarPlaca.value = inputBuscarPlaca.value.toUpperCase().replace(/\s+/g, '');
      renderListaActivos();
    });
  }

  if (btnCancelarSalida) {
    btnCancelarSalida.addEventListener('click', limpiarSalida);
  }

  if (btnRegistrarSalida) {
    btnRegistrarSalida.addEventListener('click', async () => {
      if (!activoSeleccionado) {
        mostrarToast('Seleccione un vehículo de la lista.', true);
        return;
      }

      const metodo = selectMetodoPago?.value || 'Efectivo';

      btnRegistrarSalida.classList.add('loading');
      btnRegistrarSalida.disabled = true;

      try {
        const respuesta = await pedirApi('/api/salidas', {
          method: 'POST',
          body: JSON.stringify({
            estadiaId: activoSeleccionado.id,
            metodoPago: metodo
          })
        });

        eliminarNotaLocal(activoSeleccionado.placa);

        mostrarToast(respuesta.mensaje || 'Salida registrada exitosamente.');
        await cargarSalida();
      } catch (error) {
        mostrarToast(error.message, true);
      } finally {
        btnRegistrarSalida.classList.remove('loading');
        btnRegistrarSalida.disabled = false;
      }
    });
  }

  const btnVolverADispLogin = document.getElementById('btn-volver-a-disponibilidad-desde-login');
  if (btnVolverADispLogin) {
    btnVolverADispLogin.addEventListener('click', () => {
      window.location.hash = '#disponibilidad';
      mostrarPantalla('disponibilidad');
    });
  }

  const cardModuloDisponibilidad = document.getElementById('card-modulo-disponibilidad');
  if (cardModuloDisponibilidad) {
    cardModuloDisponibilidad.addEventListener('click', () => {
      mostrarPantalla('disponibilidad');
    });
  }

  window.mostrarPantalla = mostrarPantalla;
  window.mostrarToast = mostrarToast;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewTarifas.classList.contains('active')) {
      cargarTarifaEnFormulario(selectTipo.value);
    }
    if (e.key === 'Escape' && viewIngreso.classList.contains('active')) {
      limpiarFormularioIngreso();
    }
    if (e.key === 'Escape' && viewSalida.classList.contains('active')) {
      limpiarSalida();
    }
  });

  // Restaurar la sesión de la pestaña (si existe) antes de decidir la pantalla inicial.
  const sesionRestaurada = leerSesionGuardada();
  if (sesionRestaurada) {
    rolActual = sesionRestaurada.rol || '';
    window.sesionActual = {
      usuario: sesionRestaurada.usuario,
      nombre: sesionRestaurada.nombre,
      rol: sesionRestaurada.rol
    };
    if (sessionUserName) sessionUserName.textContent = sesionRestaurada.nombre || '';
    if (sessionUserRole) sessionUserRole.textContent = sesionRestaurada.rol || '';
    if (sessionUserBadge) sessionUserBadge.textContent = sesionRestaurada.rol || '';
  }

  if (window.location.hash === '#login') {
    mostrarPantalla('login');
  } else if (sesionRestaurada) {
    mostrarPantalla('dashboard');
  } else {
    // Por defecto para todo el público conductor: Vista de Disponibilidad (UPAO-20)
    mostrarPantalla('disponibilidad');
  }

  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#login') {
      mostrarPantalla('login');
    } else if (window.location.hash === '#disponibilidad') {
      mostrarPantalla('disponibilidad');
    }
  });
});
