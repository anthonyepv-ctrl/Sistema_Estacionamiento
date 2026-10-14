document.addEventListener('DOMContentLoaded', () => {
    const cardModuloAforo = document.getElementById('card-modulo-aforo');
    const btnBackToMenuAforo = document.getElementById('btn-back-to-menu-aforo');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewAforo = document.getElementById('view-aforo');
    const parkingList = document.getElementById('parking-list');

    if (cardModuloAforo && viewDashboard && viewAforo) {
        cardModuloAforo.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.view-section').forEach(section => {
                section.classList.remove('active');
            });
            viewAforo.classList.add('active');
            cargarDatosAforo();
        });
    }

    if (btnBackToMenuAforo) {
        btnBackToMenuAforo.addEventListener('click', (e) => {
            e.preventDefault();
            viewAforo.classList.remove('active');
            viewDashboard.classList.add('active');
        });
    }

    async function cargarDatosAforo() {
        if (!parkingList) return;
        parkingList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #6b7280;">Cargando estado de la cochera...</div>';

        try {
            const res = await fetch('/api/espacios');
            if (!res.ok) throw new Error('Error al obtener datos');
            const data = await res.json();

            const autosDisp = data.autos.disponibles;
            const autosOcup = data.autos.ocupados;
            const totalAutos = data.autos.capacidad;

            const motosDisp = data.motos.disponibles;
            const motosOcup = data.motos.ocupados;
            const totalMotos = data.motos.capacidad;

            // 1. Actualizar contadores de sectores (Autos y Motos)
            if (document.getElementById('autos-disponibles')) document.getElementById('autos-disponibles').textContent = autosDisp;
            if (document.getElementById('autos-ocupados')) document.getElementById('autos-ocupados').textContent = autosOcup;
            if (document.getElementById('motos-disponibles')) document.getElementById('motos-disponibles').textContent = motosDisp;
            if (document.getElementById('motos-ocupados')) document.getElementById('motos-ocupados').textContent = motosOcup;

            // 2. Barras de progreso de disponibilidad
            if (document.getElementById('progress-autos')) {
                document.getElementById('progress-autos').style.width = totalAutos > 0 ? `${(autosDisp / totalAutos) * 100}%` : '0%';
            }
            if (document.getElementById('progress-motos')) {
                document.getElementById('progress-motos').style.width = totalMotos > 0 ? `${(motosDisp / totalMotos) * 100}%` : '0%';
            }

            // 3. Renderizar listado de vehículos actualmente dentro (Placas ocupando)
            parkingList.innerHTML = '';
            const vehiculos = data.vehiculosActivos || [];

            if (vehiculos.length === 0) {
                parkingList.innerHTML = `
                    <div style="padding: 2rem 1rem; text-align: center; color: #6b7280; font-size: 0.95rem;">
                        No hay vehículos ocupando la cochera actualmente.
                    </div>
                `;
                return;
            }

            vehiculos.forEach(v => {
                const rowElement = document.createElement('div');
                rowElement.className = 'parking-list-row occupied';

                const esAuto = (v.tipo || '').toLowerCase().includes('auto');
                const icono = esAuto ? '🚗' : '🏍️';
                
                const hora = new Date(v.horaIngreso).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });

                rowElement.innerHTML = `
                    <div class="row-left-group" style="display: flex; align-items: center; gap: 12px;">
                        <span class="spot-icon" style="font-size: 1.4rem;">${icono}</span>
                        <div>
                            <div class="spot-id-badge mono" style="font-size: 1.1rem; font-weight: 700; color: #111827; letter-spacing: 0.5px;">${v.placa}</div>
                            <div style="font-size: 0.8rem; color: #6b7280; font-weight: normal; margin-top: 2px;">${v.tipo} · Entrada: ${hora}</div>
                        </div>
                    </div>
                    <span class="status-indicator-pill occupied">Ocupando</span>
                `;

                parkingList.appendChild(rowElement);
            });

        } catch (error) {
            console.error('Error al cargar datos del aforo:', error);
            parkingList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #ef4444;">No se pudo cargar la información del aforo.</div>';
        }
    }
});
