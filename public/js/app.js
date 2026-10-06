/**
 * Sistema de Gestión de Cochera — Lógica de Interfaz conectada a la API (UPAO-34)
 */

document.addEventListener('DOMContentLoaded', () => {
  let tarifas = [];

  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewTarifas = document.getElementById('view-tarifas');
  const headerUserSection = document.getElementById('header-user-section');
  const toastContainer = document.getElementById('toast-container');
  const sessionUserName = document.getElementById('session-user-name');
  const sessionUserRole = document.getElementById('session-user-role');
  const sessionUserBadge = document.getElementById('session-user-badge');

  function mostrarPantalla(nombre) {
    viewLogin.classList.remove('active');
    viewDashboard.classList.remove('active');
    viewTarifas.classList.remove('active');

    if (nombre === 'login') {
      viewLogin.classList.add('active');
      headerUserSection.style.display = 'none';
      const userInput = document.getElementById('login-usuario');
      if (userInput) userInput.focus();
    } else if (nombre === 'dashboard') {
      viewDashboard.classList.add('active');
      headerUserSection.style.display = 'flex';
    } else if (nombre === 'tarifas') {
      viewTarifas.classList.add('active');
      headerUserSection.style.display = 'flex';
      const inputHora = document.getElementById('input-precio-hora');
      if (inputHora) inputHora.focus();
    }
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
    const respuesta = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(datos.error || 'Ocurrió un error inesperado.');
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

        if (sessionUserName) sessionUserName.textContent = sesion.usuario;
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

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewTarifas.classList.contains('active')) {
      cargarTarifaEnFormulario(selectTipo.value);
    }
  });

  mostrarPantalla('login');
});
