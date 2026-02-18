/* js/app.js */

// --- Configuration ---
const DATA_URL = 'data/incidents.json';

// Since specific lat/lng data is redacted in the source CSV, 
// we use hardcoded centers for the major operating cities to plot clusters.
const CITY_CENTERS = {
    "San Francisco": [37.7749, -122.4194],
    "Phoenix": [33.4484, -112.0740],
    "Los Angeles": [34.0522, -118.2437],
    "Austin": [30.2672, -97.7431],
    "Atlanta": [33.7490, -84.3880],
    "Tempe": [33.4255, -111.9400],
    "Chandler": [33.3062, -111.8413],
    "Scottsdale": [33.4942, -111.9261],
    "Miami": [25.7617, -80.1918],
    "Orlando": [28.5383, -81.3792],
    "Washington": [38.9072, -77.0369],
    "Dallas": [32.7767, -96.7970],
    "Mountain View": [37.3861, -122.0839],
    "Palo Alto": [37.4419, -122.1430],
    "Las Vegas": [36.1716, -115.1391],
    "Unknown": [39.8283, -98.5795] // Center of US as fallback
};

// Global State
let allData = [];
let mapInstance = null;
let cityChart = null;
let crashChart = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("Failed to load data");
        
        allData = await response.json();
        
        // 1. Update the top KPI cards
        renderStats();
        
        // 2. Initialize visualizations
        initMap();
        initCharts();
        
        // 3. Render the main feed
        renderFeed(allData);

        // 4. Setup Search Listener
        setupSearch();

    } catch (err) {
        console.error("Error initializing dashboard:", err);
        document.getElementById('feed').innerHTML = `
            <div class="p-4 text-red-600 bg-red-50 border border-red-200 rounded">
                <strong>Error loading data:</strong> Please ensure 'incidents.json' exists 
                and you are running this on a local server (Live Server).
            </div>
        `;
    }
}

// --- KPI Stats ---
function renderStats() {
    // Total
    document.getElementById('stat-total').innerText = allData.length;
    
    // Waymo Count
    const waymoCount = allData.filter(d => d.entity.includes("Waymo")).length;
    document.getElementById('stat-waymo').innerText = waymoCount;
    
    // Tesla Count
    const teslaCount = allData.filter(d => d.entity.includes("Tesla")).length;
    document.getElementById('stat-tesla').innerText = teslaCount;
}

// --- Map Logic (Leaflet) ---
function initMap() {
    // Initialize map centered on US
    mapInstance = L.map('map').setView([37.0902, -95.7129], 3);

    // Add CartoDB Light basemap (clean look)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(mapInstance);

    // Group incidents by City
    const cityCounts = {};
    allData.forEach(d => {
        // Handle "South San Francisco" mapping to "San Francisco" for visual clarity if desired
        // For now, we stick to strict city names
        const c = d.city || "Unknown";
        cityCounts[c] = (cityCounts[c] || 0) + 1;
    });

    // Plot Markers
    Object.keys(cityCounts).forEach(city => {
        // Only plot if we have coordinates for this city
        if (CITY_CENTERS[city]) {
            const count = cityCounts[city];
            
            // Calculate bubble size (min 30px, max 70px based on volume)
            const size = Math.min(70, 30 + Math.sqrt(count) * 5);
            
            // Create custom HTML marker
            const icon = L.divIcon({
                className: 'custom-map-icon', // This class is empty, we style the inner div
                html: `<div class="city-marker" style="width:${size}px; height:${size}px;">${count}</div>`,
                iconSize: [size, size],
                iconAnchor: [size/2, size/2]
            });

            // Add marker to map
            L.marker(CITY_CENTERS[city], { icon: icon })
                .addTo(mapInstance)
                .bindPopup(`
                    <div class="text-center">
                        <strong class="text-lg">${city}</strong><br>
                        <span class="text-gray-600">${count} Incidents</span>
                    </div>
                `);
        }
    });
}

// --- Charts Logic (Chart.js) ---
function initCharts() {
    // -- Chart 1: Incidents by City --
    const cityCtx = document.getElementById('chartCity').getContext('2d');
    
    // Aggregate Data
    const cityCounts = {};
    allData.forEach(d => cityCounts[d.city] = (cityCounts[d.city] || 0) + 1);
    
    // Sort and Top 10
    const sortedCities = Object.entries(cityCounts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 10);

    cityChart = new Chart(cityCtx, {
        type: 'bar',
        data: {
            labels: sortedCities.map(x => x[0]),
            datasets: [{
                label: 'Incidents',
                data: sortedCities.map(x => x[1]),
                backgroundColor: '#3B82F6', // Tailwind Blue-500
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });

    // -- Chart 2: Crash Partners (Who did they hit?) --
    const crashCtx = document.getElementById('chartCrash').getContext('2d');
    
    // Aggregate Data
    const crashCounts = {};
    allData.forEach(d => {
        let key = d.crash_with || "Unknown";
        // Clean up long names
        if(key.includes("Fixed Object")) key = "Fixed Object";
        crashCounts[key] = (crashCounts[key] || 0) + 1;
    });

    // Sort and Top 6
    const sortedCrash = Object.entries(crashCounts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 6);

    crashChart = new Chart(crashCtx, {
        type: 'doughnut',
        data: {
            labels: sortedCrash.map(x => x[0]),
            datasets: [{
                data: sortedCrash.map(x => x[1]),
                backgroundColor: [
                    '#EF4444', // Red
                    '#F59E0B', // Amber
                    '#10B981', // Emerald
                    '#3B82F6', // Blue
                    '#6366F1', // Indigo
                    '#8B5CF6'  // Violet
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } }
            },
            cutout: '60%'
        }
    });
}

// --- Feed Rendering (The List) ---
function renderFeed(data) {
    const container = document.getElementById('feed');
    container.innerHTML = ''; // Clear current list

    if (data.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-8">No incidents found matching your search.</div>';
        return;
    }

    data.forEach(item => {
        // Determine Styling based on Entity
        const isTesla = item.entity.includes("Tesla");
        const borderClass = isTesla ? 'tesla-border' : 'waymo-border';
        const badgeClass = isTesla ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
        
        // Handle Narrative Content
        let narrativeHTML = '';
        
        if (item.redacted) {
            // THE REDACTED UI
            // We strip the "Scenario:" prefix for cleaner display if present
            const cleanText = item.narrative.replace('REDACTED BY MANUFACTURER. Inferred: ', '');
            
            narrativeHTML = `
                <div class="redacted-wrapper">
                    <div class="redacted-label">REDACTED BY MANUFACTURER</div>
                    <div class="text-sm italic text-gray-700 mb-2">
                        ${cleanText}
                    </div>
                    <div aria-hidden="true" class="opacity-50 text-xs">
                        <span class="redacted-text-bar" style="width: 80%"></span>
                        <span class="redacted-text-bar" style="width: 60%"></span>
                        <span class="redacted-text-bar" style="width: 90%"></span>
                        <span class="redacted-text-bar" style="width: 40%"></span>
                    </div>
                </div>
            `;
        } else {
            // STANDARD NARRATIVE
            narrativeHTML = `
                <p class="text-sm text-gray-700 mt-2 leading-relaxed">
                    ${item.narrative}
                </p>
            `;
        }

        // Build Card HTML
        const card = document.createElement('div');
        card.className = `incident-card ${borderClass}`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="${badgeClass} text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                        ${item.entity}
                    </span>
                    <span class="text-xs text-gray-400 font-mono ml-2">${item.date}</span>
                </div>
                <div class="text-right">
                    <div class="text-xs font-bold text-gray-600">${item.city}, ${item.state}</div>
                </div>
            </div>
            
            <div class="mb-3">
                 <div class="text-sm font-semibold text-gray-800">
                    ${item.movement} 
                    <span class="text-gray-400 font-normal mx-1">vs</span> 
                    ${item.crash_with}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                    Severity: <span class="font-medium">${item.severity}</span>
                </div>
            </div>

            ${narrativeHTML}
        `;

        container.appendChild(card);
    });
}

// --- Search Logic ---
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        // Filter Data
        const filtered = allData.filter(item => {
            return (
                item.narrative.toLowerCase().includes(term) ||
                item.city.toLowerCase().includes(term) ||
                item.crash_with.toLowerCase().includes(term) ||
                item.entity.toLowerCase().includes(term)
            );
        });

        renderFeed(filtered);
    });
}