document.addEventListener('DOMContentLoaded', () => {
    const cardModuloAforo = document.getElementById('card-modulo-aforo');
    const btnBackToMenuAforo = document.getElementById('btn-back-to-menu-aforo');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewAforo = document.getElementById('view-aforo');
    const parkingList = document.getElementById('parking-list');

    // 1. Datos del aforo simplificados al máximo (Solo lo requerido por la rúbrica)
    const plazasSimuladas = [
        { id: 'A-01', tipo: 'auto', estado: 'occupied' },
        { id: 'A-02', tipo: 'auto', estado: 'available' },
        { id: 'A-03', tipo: 'auto', estado: 'available' },
        { id: 'A-04', tipo: 'auto', estado: 'occupied' },
        { id: 'A-05', tipo: 'auto', estado: 'available' },
        { id: 'M-01', tipo: 'moto', estado: 'available' },
        { id: 'M-02', tipo: 'moto', estado: 'occupied' },
        { id: 'M-03', tipo: 'moto', estado: 'occupied' },
        { id: 'M-04', tipo: 'moto', estado: 'available' }
    ];

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
        parkingList.innerHTML = '<div style="padding: 1rem; text-align: center; color: #6b7280;">Cargando estado de espacios...</div>';

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

            // Actualizar marcadores de los sectores
            if (document.getElementById('autos-disponibles')) document.getElementById('autos-disponibles').textContent = autosDisp;
            if (document.getElementById('autos-ocupados')) document.getElementById('autos-ocupados').textContent = autosOcup;
            if (document.getElementById('motos-disponibles')) document.getElementById('motos-disponibles').textContent = motosDisp;
            if (document.getElementById('motos-ocupados')) document.getElementById('motos-ocupados').textContent = motosOcup;

            // Barras de progreso (disponibilidad)
            if (document.getElementById('progress-autos')) {
                document.getElementById('progress-autos').style.width = totalAutos > 0 ? `${(autosDisp / totalAutos) * 100}%` : '0%';
            }
            if (document.getElementById('progress-motos')) {
                document.getElementById('progress-motos').style.width = totalMotos > 0 ? `${(motosDisp / totalMotos) * 100}%` : '0%';
            }

            // Renderizar visualmente el listado de espacios basado en capacidad y ocupados reales
            parkingList.innerHTML = '';
            
            // Plazas de autos
            for (let i = 1; i <= totalAutos; i++) {
                const id = `A-${String(i).padStart(2, '0')}`;
                const estaOcupado = i <= autosOcup;
                const estado = estaOcupado ? 'occupied' : 'available';
                const estadoLabel = estaOcupado ? 'Ocupado' : 'Disponible';
                
                const rowElement = document.createElement('div');
                rowElement.className = `parking-list-row ${estado}`;
                rowElement.innerHTML = `
                    <div class="row-left-group">
                        <span class="spot-icon">🚗</span>
                        <span class="spot-id-badge">${id}</span>
                    </div>
                    <span class="status-indicator-pill ${estado}">${estadoLabel}</span>
                `;
                parkingList.appendChild(rowElement);
            }

            // Plazas de motos
            for (let j = 1; j <= totalMotos; j++) {
                const id = `M-${String(j).padStart(2, '0')}`;
                const estaOcupado = j <= motosOcup;
                const estado = estaOcupado ? 'occupied' : 'available';
                const estadoLabel = estaOcupado ? 'Ocupado' : 'Disponible';
                
                const rowElement = document.createElement('div');
                rowElement.className = `parking-list-row ${estado}`;
                rowElement.innerHTML = `
                    <div class="row-left-group">
                        <span class="spot-icon">🏍️</span>
                        <span class="spot-id-badge">${id}</span>
                    </div>
                    <span class="status-indicator-pill ${estado}">${estadoLabel}</span>
                `;
                parkingList.appendChild(rowElement);
            }
        } catch (error) {
            console.error('Error al cargar datos del aforo:', error);
            parkingList.innerHTML = '<div style="padding: 1rem; text-align: center; color: #ef4444;">No se pudo cargar el estado de espacios.</div>';
        }
    }
});
