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

    // 2. Renderizado limpio: SIN PLACAS NI HORAS
    function cargarDatosAforo() {
        if (!parkingList) return;
        parkingList.innerHTML = ''; 

        let autosDisp = 0, autosOcup = 0;
        let motosDisp = 0, motosOcup = 0;

        plazasSimuladas.forEach(plaza => {
            const rowElement = document.createElement('div');
            rowElement.className = `parking-list-row ${plaza.estado}`;
            
            const icono = plaza.tipo === 'auto' ? '🚗' : '🏍️';
            const estadoLabel = plaza.estado === 'available' ? 'Disponible' : 'Ocupado';
            
            // AQUÍ QUEDÓ ELIMINADO TODO LO DEMÁS. Solo va Identificador e Insignia.
            rowElement.innerHTML = `
                <div class="row-left-group">
                    <span class="spot-icon">${icono}</span>
                    <span class="spot-id-badge">${plaza.id}</span>
                </div>
                <span class="status-indicator-pill ${plaza.estado}">${estadoLabel}</span>
            `;
            
            parkingList.appendChild(rowElement);

            if (plaza.tipo === 'auto') {
                if (plaza.estado === 'available') autosDisp++; else autosOcup++;
            } else if (plaza.tipo === 'moto') {
                if (plaza.estado === 'available') motosDisp++; else motosOcup++;
            }
        });

        // Actualizar marcadores de los sectores
        if (document.getElementById('autos-disponibles')) document.getElementById('autos-disponibles').textContent = autosDisp;
        if (document.getElementById('autos-ocupados')) document.getElementById('autos-ocupados').textContent = autosOcup;
        if (document.getElementById('motos-disponibles')) document.getElementById('motos-disponibles').textContent = motosDisp;
        if (document.getElementById('motos-ocupados')) document.getElementById('motos-ocupados').textContent = motosOcup;

        // Barras de progreso
        const totalAutos = autosDisp + autosOcup;
        const totalMotos = motosDisp + motosOcup;
        
        if (document.getElementById('progress-autos')) {
            document.getElementById('progress-autos').style.width = totalAutos > 0 ? `${(autosDisp / totalAutos) * 100}%` : '0%';
        }
        if (document.getElementById('progress-motos')) {
            document.getElementById('progress-motos').style.width = totalMotos > 0 ? `${(motosDisp / totalMotos) * 100}%` : '0%';
        }
    }
});
