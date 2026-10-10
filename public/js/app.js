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
  const headerUserSection = document.getElementById('header-user-section');
  const toastContainer = document.getElementById('toast-container');
  const sessionUserName = document.getElementById('session-user-name');
  const sessionUserRole = document.getElementById('session-user-role');
  const sessionUserBadge = document.getElementById('session-user-badge');

  function mostrarPantalla(nombre) {
    viewLogin.classList.remove('active');
    viewDashboard.classList.remove('active');
    viewTarifas.classList.remove('active');
    viewIngreso.classList.remove('active');

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
    }
  }

  function aplicarMenuPorRol(rol) {
    const esDueno = rol === 'DUENO' || rol === 'DUEÑO';
    const esRecepcionista = rol === 'RECEPCIONISTA';

    const cardTarifas = document.getElementById('card-modulo-tarifas');
    const cardIngreso = document.getElementById('card-modulo-ingreso');

    if (cardTarifas) cardTarifas.style.display = esDueno ? '' : 'none';
    if (cardIngreso) cardIngreso.style.display = esRecepcionista ? '' : 'none';
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

  async function pedirApi(url, opciones = {}) {
    let respuesta;

    try {
      respuesta = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opciones
      });
    } catch (error) {
      throw new Error('No se pudo conectar con el servidor. Verifica que esté corriendo (npm run dev).');
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
      mostrarPantalla('login');
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

  const PLACA_REGEX = {
    auto: /^[A-Z0-9]{3}-?[A-Z0-9]{3}$/,
    moto: /^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/
  };

  const ETIQUETA_TIPO = {
    auto: 'Automóvil',
    moto: 'Motocicleta'
  };

  function analizarPlaca(limpio) {
    if (/^\d/.test(limpio)) {
      return { tipo: 'moto', corte: 4 };
    }

    const letras = (limpio.match(/^[A-Z]+/) || [''])[0].length;

    if (letras === 2 && /\d/.test(limpio)) {
      return { tipo: 'moto', corte: 2 };
    }

    return { tipo: 'auto', corte: 3 };
  }

  function normalizarPlaca(valor) {
    const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (limpio.length === 0) return '';

    const { corte } = analizarPlaca(limpio);
    if (limpio.length <= corte) return limpio;

    return `${limpio.slice(0, corte)}-${limpio.slice(corte, 6)}`;
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
      selectTipoIngreso.value = inferirTipo(inputPlaca.value);
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

      if (btnRegistrarIngreso) {
        btnRegistrarIngreso.classList.add('loading');
        btnRegistrarIngreso.disabled = true;
      }

      try {
        const ingreso = await pedirApi('/api/ingresos', {
          method: 'POST',
          body: JSON.stringify({ placa, tipo })
        });

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

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewTarifas.classList.contains('active')) {
      cargarTarifaEnFormulario(selectTipo.value);
    }
    if (e.key === 'Escape' && viewIngreso.classList.contains('active')) {
      limpiarFormularioIngreso();
    }
  });

  mostrarPantalla('login');
});
