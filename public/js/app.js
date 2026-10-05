/**
 * Sistema de Gestión de Cochera — Lógica Básica de Interfaz (Sprint 1 / UPAO-32)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Datos vigentes de tarifas (Autos, Motos, Reservas)
  const tarifas = [
    {
      id: 'auto',
      nombre: 'Automóvil / Camioneta',
      precio_hora: 4.50,
      precio_fraccion: 2.50,
      estado: 'ACTIVA'
    },
    {
      id: 'moto',
      nombre: 'Motocicleta',
      precio_hora: 2.50,
      precio_fraccion: 1.50,
      estado: 'ACTIVA'
    },
    {
      id: 'reserva',
      nombre: 'Reserva Web',
      precio_hora: 5.00,
      precio_fraccion: 3.00,
      estado: 'ACTIVA'
    }
  ];

  // Elementos de vistas
  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewTarifas = document.getElementById('view-tarifas');
  const headerUserSection = document.getElementById('header-user-section');
  const toastContainer = document.getElementById('toast-container');

  // Control simple de navegación de pantallas
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

  // Notificación Toast estándar (3.8 segundos)
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

  // 1. PANTALLA DE LOGIN
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
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();

      const usuario = inputUsuario.value.trim();
      const password = inputPassword.value.trim();

      if (!usuario) {
        mostrarErrorCampo(inputUsuario, 'Ingrese su usuario o correo.');
        return;
      }
      if (!password) {
        mostrarErrorCampo(inputPassword, 'Ingrese su contraseña.');
        return;
      }

      // Estado de carga y pase al menú principal
      btnLoginSubmit.classList.add('loading');
      setTimeout(() => {
        btnLoginSubmit.classList.remove('loading');
        mostrarPantalla('dashboard');
      }, 400);
    });
  }

  // Cerrar sesión
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      mostrarPantalla('login');
    });
  }

  // 2. PANTALLA DE MENÚ PRINCIPAL
  const cardModuloTarifas = document.getElementById('card-modulo-tarifas');
  if (cardModuloTarifas) {
    cardModuloTarifas.addEventListener('click', () => {
      mostrarPantalla('tarifas');
      cargarTarifaEnFormulario('auto');
    });
  }

  // 3. PANTALLA DEL MÓDULO DE TARIFAS
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

  // Renderizar tabla de tarifas
  function renderTablaTarifas() {
    if (!tablaBody) return;

    tablaBody.innerHTML = tarifas.map(item => `
      <tr>
        <td style="font-weight: 500;">${item.nombre}</td>
        <td class="mono" style="font-weight: 700; color: var(--primary);">S/ ${item.precio_hora.toFixed(2)}</td>
        <td class="mono" style="font-weight: 600;">S/ ${item.precio_fraccion.toFixed(2)}</td>
        <td><span class="badge badge-success">${item.estado}</span></td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm btn-editar-fila" data-id="${item.id}">
            Modificar
          </button>
        </td>
      </tr>
    `).join('');

    // Eventos de botones Modificar en la tabla
    tablaBody.querySelectorAll('.btn-editar-fila').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        cargarTarifaEnFormulario(id);
      });
    });
  }

  // Cargar datos al formulario
  function cargarTarifaEnFormulario(id) {
    const tarifa = tarifas.find(t => t.id === id);
    if (!tarifa) return;

    selectTipo.value = tarifa.id;
    inputPrecioHora.value = tarifa.precio_hora.toFixed(2);
    inputPrecioFraccion.value = tarifa.precio_fraccion.toFixed(2);
    formTitle.textContent = `Modificar Tarifa: ${tarifa.nombre}`;

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

  // Validar monto según normativa (0.01 - 999.99 con 2 decimales)
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

  // Validación en vivo al escribir
  inputPrecioHora?.addEventListener('input', () => validarMonto(inputPrecioHora));
  inputPrecioFraccion?.addEventListener('input', () => validarMonto(inputPrecioFraccion));

  // Procesar actualización de tarifa
  if (formTarifa) {
    formTarifa.addEventListener('submit', (e) => {
      e.preventDefault();

      const esHoraValida = validarMonto(inputPrecioHora);
      const esFraccionValida = validarMonto(inputPrecioFraccion);

      if (!esHoraValida || !esFraccionValida) {
        return;
      }

      // Prevención de doble clic y feedback de guardado
      btnGuardarTarifa.classList.add('loading');
      btnGuardarTarifa.disabled = true;

      setTimeout(() => {
        const idSeleccionado = selectTipo.value;
        const tarifa = tarifas.find(t => t.id === idSeleccionado);
        if (tarifa) {
          tarifa.precio_hora = parseFloat(inputPrecioHora.value);
          tarifa.precio_fraccion = parseFloat(inputPrecioFraccion.value);
        }

        renderTablaTarifas();

        btnGuardarTarifa.classList.remove('loading');
        btnGuardarTarifa.disabled = false;

        // Criterio exacto de aceptación de la historia UPAO-16
        mostrarToast('Tarifa actualizada correctamente');
      }, 400);
    });
  }

  // Atajos de teclado (ENTER envía, ESC cancela)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewTarifas.classList.contains('active')) {
      cargarTarifaEnFormulario(selectTipo.value);
    }
  });

  // Inicialización
  renderTablaTarifas();
  mostrarPantalla('login');
});
