(function () {
  let solicitudPendiente = null;

  function limpiarPendiente() {
    solicitudPendiente = null;
  }

  function cancelarSiPendiente() {
    if (solicitudPendiente) {
      const { reject } = solicitudPendiente;
      limpiarPendiente();
      reject(Object.assign(new Error('Pago cancelado por el usuario.'), { cancelado: true }));
    }
    if (window.Culqi && typeof window.Culqi.close === 'function') {
      try { window.Culqi.close(); } catch (_) {}
    }
  }

  function manejarRespuestaCulqi() {
    const pendiente = solicitudPendiente;
    limpiarPendiente();
    if (!pendiente) return;

    const Culqi = window.Culqi;
    if (Culqi && Culqi.token && Culqi.token.id) {
      const resultado = {
        sourceToken: Culqi.token.id,
        email: Culqi.token.email || ''
      };
      try {
        if (typeof Culqi.close === 'function') Culqi.close();
      } catch (_) {}
      pendiente.resolve(resultado);
      return;
    }

    const msg = (Culqi && Culqi.error && (Culqi.error.user_message || Culqi.error.merchant_message))
      || 'No se pudo completar el pago con Culqi.';
    try {
      if (Culqi && typeof Culqi.close === 'function') Culqi.close();
    } catch (_) {}
    pendiente.reject(new Error(msg));
  }

  function iniciarPago({ proveedor, publishableKey, montoCentimos, titulo, yapeHabilitado }) {
    if (proveedor && proveedor !== 'culqi') {
      return Promise.reject(new Error(`Pasarela no soportada en el navegador: ${proveedor}`));
    }

    if (typeof window.Culqi === 'undefined') {
      return Promise.reject(new Error('No se pudo cargar Culqi Checkout v4. Verifique su conexión a internet.'));
    }

    if (!publishableKey) {
      return Promise.reject(new Error('La pasarela de pagos Culqi aún no está configurada.'));
    }

    if (solicitudPendiente) {
      cancelarSiPendiente();
    }

    window.culqi = manejarRespuestaCulqi;

    window.Culqi.publicKey = publishableKey;
    window.Culqi.settings({
      title: titulo || 'Sistema de Cochera',
      currency: 'PEN',
      amount: Number(montoCentimos)
    });
    window.Culqi.options({
      lang: 'es',
      installments: false,
      paymentMethods: {
        tarjeta: true,
        yape: Boolean(yapeHabilitado),
        billetera: false,
        bancaMovil: false,
        agente: false,
        cuotealo: false
      }
    });

    return new Promise((resolve, reject) => {
      solicitudPendiente = { resolve, reject };
      try {
        window.Culqi.open();
      } catch (err) {
        limpiarPendiente();
        reject(err);
      }
    });
  }

  window.PasarelaPago = {
    iniciarPago,
    cancelarSiPendiente
  };
})();
