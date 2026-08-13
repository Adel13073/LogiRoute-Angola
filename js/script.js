
let stops = [];
let mode = 'fastest';
let map, routeLayer;
let stopMarkers = [];
let stopIdCounter = 0;
let isCalculating = false;

const QUICK_STOPS = [
  'Viana','Luanda Sul','Camama','Zango',
  'Cacuaco','Cazenga','Sambizanga','Ingombota',
  'Maianga','Rangel','Samba','Belas',
  'Kilamba','Talatona','Benfica','Rocha Pinto',
  'Palanca','Vila Alice'
];

// Luanda bounding box center
const LUANDA_CENTER = [-8.8368, 13.2343];


function initMap() {
  map = L.map('map', {
    center: LUANDA_CENTER,
    zoom: 12,
    zoomControl: true,
    attributionControl: true
  });

  // Dark tile layer (CartoDB Dark Matter — free, no key)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  routeLayer = L.layerGroup().addTo(map);
}


async function addStop(name) {
  const input = document.getElementById('newStopInput');
  const val = name || input.value.trim();
  if (!val) return;

  const query = val.includes('Angola') || val.includes('Luanda') ? val : val + ', Luanda, Angola';

  // Geocode using Nominatim (free OSM geocoding)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ao`,
      { headers: { 'Accept-Language': 'pt' } }
    );
    const data = await res.json();

    let lat, lng, displayName;
    if (data.length > 0) {
      lat = parseFloat(data[0].lat);
      lng = parseFloat(data[0].lon);
      displayName = data[0].display_name.split(',').slice(0, 2).join(',').trim();
    } else {
      // Fallback: place near Luanda center with slight offset for demo
      lat = LUANDA_CENTER[0] + (Math.random() - 0.5) * 0.08;
      lng = LUANDA_CENTER[1] + (Math.random() - 0.5) * 0.08;
      displayName = val + ', Luanda';
      toast(`"${val}" — localização aproximada (geocodificação falhou)`, 'info');
    }

    const stop = { id: ++stopIdCounter, name: val, address: displayName, lat, lng };
    stops.push(stop);
    if (!name) input.value = '';
    renderStops();
    updateCalcBtn();
    toast(`"${val}" adicionado.`, 'success');

  } catch (err) {
    
    const lat = LUANDA_CENTER[0] + (Math.random() - 0.5) * 0.1;
    const lng = LUANDA_CENTER[1] + (Math.random() - 0.5) * 0.1;
    const stop = { id: ++stopIdCounter, name: val, address: val + ', Luanda', lat, lng };
    stops.push(stop);
    if (!name) input.value = '';
    renderStops();
    updateCalcBtn();
    toast(`"${val}" adicionado (modo offline).`, 'info');
  }
}

function removeStop(id) {
  stops = stops.filter(s => s.id !== id);
  renderStops();
  updateCalcBtn();
}

function moveStop(id, dir) {
  const i = stops.findIndex(s => s.id === id);
  const ni = i + dir;
  if (i < 0 || ni < 0 || ni >= stops.length) return;
  [stops[i], stops[ni]] = [stops[ni], stops[i]];
  renderStops();
}

function renderStops() {
  const list = document.getElementById('stopsList');
  if (stops.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:14px;font-size:.78rem;color:var(--text-dim)">Nenhuma paragem adicionada.<br/>Use os bairros abaixo ou escreva um endereço.</div>';
    return;
  }
  list.innerHTML = stops.map((s, i) => {
    const cls = i === 0 ? 'origin' : (i === stops.length - 1 ? 'dest' : 'mid');
    const lbl = i === 0 ? '⊙' : (i === stops.length - 1 ? '⊕' : i + 1);
    return `<div class="stop-item" data-id="${s.id}">
      <div class="stop-num ${cls}">${lbl}</div>
      <div class="stop-info">
        <div class="stop-name">${s.name}</div>
        <div class="stop-addr">${s.address}</div>
      </div>
      <div class="stop-actions">
        ${i > 0 ? `<button class="icon-btn" onclick="moveStop(${s.id},-1)" title="Subir">↑</button>` : ''}
        ${i < stops.length-1 ? `<button class="icon-btn" onclick="moveStop(${s.id},1)" title="Descer">↓</button>` : ''}
        <button class="icon-btn del" onclick="removeStop(${s.id})" title="Remover">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderQuickGrid() {
  document.getElementById('quickGrid').innerHTML = QUICK_STOPS.map(b =>
    `<button class="qbtn" onclick="addStop('${b}')">${b}</button>`
  ).join('');
}


function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  document.getElementById('mode-' + m).classList.add('active');
}


async function calculateRoute() {
  if (stops.length < 2 || isCalculating) return;
  isCalculating = true;

  showOverlay('A geocodificar pontos…');
  document.getElementById('mapEmpty').classList.add('hidden');

  try {
    // Optimize stop order (nearest neighbor heuristic for small sets)
    const ordered = mode === 'fastest' ? stops : optimizeOrder([...stops]);

    // Get depot coordinates
    const depotInput = document.getElementById('depotInput').value.trim() || 'Luanda, Angola';
    const depotCoords = await geocode(depotInput);

    updateOverlay('A calcular rota com OSRM…');

    // Build waypoints: depot → stops
    const allPoints = [depotCoords, ...ordered.map(s => ({ lat: s.lat, lng: s.lng }))];

    // Call OSRM public API (free, no key)
    const coordStr = allPoints.map(p => `${p.lng},${p.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(osrmUrl);
    const data = await res.json();

    hideOverlay();
    isCalculating = false;

    if (data.code === 'Ok' && data.routes.length > 0) {
      const route = data.routes[0];
      drawRoute(route, ordered, depotCoords);
      const legs = route.legs;
      showResults(route, legs, ordered, depotInput);
      toast('Rota calculada com sucesso via OSRM!', 'success');
    } else {
      // Fallback to straight-line demo
      runDemoRoute(ordered, depotCoords);
      toast('OSRM indisponível — usando modo de estimativa.', 'info');
    }

  } catch (err) {
    hideOverlay();
    isCalculating = false;
    // Fallback demo
    const ordered = optimizeOrder([...stops]);
    const depotCoords = { lat: LUANDA_CENTER[0], lng: LUANDA_CENTER[1] };
    runDemoRoute(ordered, depotCoords);
    toast('Sem conexão à internet — usando estimativa local.', 'info');
  }
}

// ══════════════════════════════════════════════════
// DRAW ROUTE
// ══════════════════════════════════════════════════
function drawRoute(osrmRoute, ordered, depot) {
  routeLayer.clearLayers();
  stopMarkers = [];

  // Route polyline from OSRM geometry
  const geojson = osrmRoute.geometry;
  const routeLine = L.geoJSON(geojson, {
    style: {
      color: '#00c8ff',
      weight: 4,
      opacity: 0.85,
      dashArray: null,
      lineCap: 'round',
      lineJoin: 'round'
    }
  }).addTo(routeLayer);

  // Fit map to route
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

  // Depot marker
  addMarker(depot.lat, depot.lng, '🏭', `<strong>Base:</strong> ${document.getElementById('depotInput').value || 'Depósito'}`, 'origin');

  // Stop markers
  ordered.forEach((s, i) => {
    const isLast = i === ordered.length - 1;
    const icon = isLast ? '🏁' : `${i + 1}`;
    addMarker(s.lat, s.lng, icon, `<strong>${s.name}</strong><br/><small>${s.address}</small>`, isLast ? 'dest' : 'mid');
  });
}

function addMarker(lat, lng, label, popup, type) {
  const colors = { origin: '#10b981', mid: '#00c8ff', dest: '#ef4444' };
  const color = colors[type] || '#00c8ff';

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${type === 'origin' ? 'rgba(16,185,129,.2)' : type === 'dest' ? 'rgba(239,68,68,.2)' : 'rgba(0,200,255,.15)'};
      border:2px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-size:.7rem;font-weight:700;color:${color};
      font-family:'IBM Plex Mono',monospace;
      box-shadow:0 0 12px ${color}44;
      backdrop-filter:blur(4px);
    ">${typeof label === 'string' && label.length > 1 ? label : label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const marker = L.marker([lat, lng], { icon })
    .bindPopup(`<div style="font-family:'DM Sans',sans-serif;font-size:13px;color:#e8f0fe">${popup}</div>`)
    .addTo(routeLayer);
  stopMarkers.push(marker);
}

// ══════════════════════════════════════════════════
// DEMO ROUTE (offline fallback — straight lines)
// ══════════════════════════════════════════════════
function runDemoRoute(ordered, depot) {
  routeLayer.clearLayers();

  const allPoints = [depot, ...ordered.map(s => ({ lat: s.lat, lng: s.lng }))];

  // Draw dashed line between points
  L.polyline(allPoints.map(p => [p.lat, p.lng]), {
    color: '#00c8ff', weight: 3, opacity: 0.6,
    dashArray: '8 6'
  }).addTo(routeLayer);


  map.fitBounds(L.latLngBounds(allPoints.map(p => [p.lat, p.lng])), { padding: [40, 40] });

  // Markers
  addMarker(depot.lat, depot.lng, '🏭', `<strong>Base</strong>`, 'origin');
  ordered.forEach((s, i) => addMarker(s.lat, s.lng, i + 1, `<strong>${s.name}</strong>`, i === ordered.length - 1 ? 'dest' : 'mid'));

  // Demo stats
  let totalDist = 0;
  for (let i = 1; i < allPoints.length; i++) {
    totalDist += haversine(allPoints[i-1].lat, allPoints[i-1].lng, allPoints[i].lat, allPoints[i].lng);
  }
  const totalTime = Math.round(totalDist / 35 * 60); // ~35km/h average Luanda
  const fuel = parseFloat(document.getElementById('fuelConsumption').value);
  const price = parseFloat(document.getElementById('fuelPrice').value);
  const litres = (totalDist * fuel / 100).toFixed(1);
  const cost = Math.round(parseFloat(litres) * price);

  showDemoResults(totalDist.toFixed(1), totalTime, litres, cost, ordered);
}

// Haversine distance (km)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}


// RESULTS
function showResults(route, legs, ordered, depotName) {
  const totalDist = (route.distance / 1000).toFixed(1);
  const totalTime = Math.round(route.duration / 60);
  const fuel = parseFloat(document.getElementById('fuelConsumption').value);
  const price = parseFloat(document.getElementById('fuelPrice').value);
  const litres = (route.distance / 1000 * fuel / 100).toFixed(1);
  const cost = Math.round(parseFloat(litres) * price);

  const hrs = Math.floor(totalTime / 60);
  const mins = totalTime % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${mins}min` : `${mins} min`;

  renderKPIs(totalDist, timeStr, litres, cost, ordered.length, false);
  renderRouteSteps(depotName, ordered, legs);
  document.getElementById('resultsPanel').classList.add('show');
}

function showDemoResults(km, totalMin, litres, cost, ordered) {
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${mins}min` : `${mins} min`;
  renderKPIs(km, timeStr, litres, cost, ordered.length, true);
  renderRouteStepsDemo(ordered);
  document.getElementById('resultsPanel').classList.add('show');
}

function renderKPIs(km, time, litres, cost, nStops, isDemo) {
  document.getElementById('res-stats').innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Distância</div><div class="kpi-val cyan">${km}<span style="font-size:.7rem;font-weight:400;color:var(--text-dim)"> km</span></div></div>
      <div class="kpi"><div class="kpi-label">Tempo Est.</div><div class="kpi-val amber">${time}</div></div>
      <div class="kpi"><div class="kpi-label">Comb. (Kz)</div><div class="kpi-val green">${parseInt(cost).toLocaleString()}</div></div>
      <div class="kpi-full">
        <div class="kpi-full-item"><div class="kpi-full-label">Consumo</div><div class="kpi-full-val">${litres} L</div></div>
        <div class="kpi-full-item"><div class="kpi-full-label">Paragens</div><div class="kpi-full-val">${nStops}</div></div>
        <div class="kpi-full-item"><div class="kpi-full-label">Modo</div><div class="kpi-full-val" style="color:var(--cyan)">${getModeLabel()}</div></div>
        ${isDemo ? '<div style="font-size:.65rem;color:var(--amber);background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.18);border-radius:5px;padding:2px 7px;">ESTIMATIVA</div>' : ''}
      </div>
    </div>
  `;
}

function renderRouteSteps(depotName, ordered, legs) {
  const allNames = [depotName, ...ordered.map(s => s.name)];
  let html = '';
  allNames.forEach((name, i) => {
    const isLast = i === allNames.length - 1;
    const dotCls = i === 0 ? 'origin' : (isLast ? 'dest' : 'mid');
    const leg = legs[i - 1];
    const segTxt = leg ? `${(leg.distance/1000).toFixed(1)} km · ~${Math.round(leg.duration/60)} min` : '';
    html += `<div class="route-step">
      <div class="rs-track">
        <div class="rs-dot ${dotCls}"></div>
        ${!isLast ? '<div class="rs-line"></div>' : ''}
      </div>
      <div class="rs-info">
        <div class="rs-name">${name}</div>
        ${segTxt ? `<div class="rs-seg">${segTxt}</div>` : ''}
      </div>
    </div>`;
  });
  document.getElementById('res-route').innerHTML = html;
}

function renderRouteStepsDemo(ordered) {
  const depotName = document.getElementById('depotInput').value || 'Base';
  const allNames = [depotName, ...ordered.map(s => s.name)];
  let html = '';
  allNames.forEach((name, i) => {
    const isLast = i === allNames.length - 1;
    const dotCls = i === 0 ? 'origin' : (isLast ? 'dest' : 'mid');
    html += `<div class="route-step">
      <div class="rs-track">
        <div class="rs-dot ${dotCls}"></div>
        ${!isLast ? '<div class="rs-line"></div>' : ''}
      </div>
      <div class="rs-info"><div class="rs-name">${name}</div></div>
    </div>`;
  });
  document.getElementById('res-route').innerHTML = html;
}


function optimizeOrder(arr) {
  // Nearest neighbor heuristic
  if (arr.length <= 2) return arr;
  const result = [arr[0]];
  const remaining = arr.slice(1);
  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = haversine(last.lat, last.lng, s.lat, s.lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    result.push(remaining.splice(bestIdx, 1)[0]);
  }
  return result;
}

async function geocode(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'pt' } }
    );
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return { lat: LUANDA_CENTER[0], lng: LUANDA_CENTER[1] };
}

function getModeLabel() {
  return { fastest: '⚡ Mais Rápida', shortest: '📏 Menos Km', fuel: '⛽ Económica' }[mode];
}

function updateCalcBtn() {
  document.getElementById('calcBtn').disabled = stops.length < 2;
}

function switchTab(tab, btn) {
  document.querySelectorAll('.rtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.res-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('res-' + tab).classList.add('active');
}

function clearAll() {
  stops = [];
  renderStops();
  updateCalcBtn();
  routeLayer.clearLayers();
  document.getElementById('resultsPanel').classList.remove('show');
  document.getElementById('mapEmpty').classList.remove('hidden');
  map.setView(LUANDA_CENTER, 12);
  toast('Tudo limpo.', 'info');
}

function exportRoute() {
  if (stops.length === 0) { toast('Nenhuma rota para exportar.', 'error'); return; }
  const depot = document.getElementById('depotInput').value || 'Base';
  const lines = [
    'LOGIROU ANGOLA · ELEVEN Technology',
    `Data: ${new Date().toLocaleDateString('pt-AO')}`,
    `Modo: ${getModeLabel()}`,
    '',
    `BASE: ${depot}`,
    '',
    ...stops.map((s, i) => `${i + 1}. ${s.name} — ${s.address} (${s.lat.toFixed(5)}, ${s.lng.toFixed(5)})`)
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rota_luanda_${Date.now()}.txt`;
  a.click();
  toast('Rota exportada!', 'success');
}

function showOverlay(text) {
  document.getElementById('overlayText').textContent = text;
  document.getElementById('mapOverlay').classList.remove('hidden');
}
function updateOverlay(text) { document.getElementById('overlayText').textContent = text; }
function hideOverlay() { document.getElementById('mapOverlay').classList.add('hidden'); }

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span style="font-weight:700">${icons[type]}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}


window.addEventListener('load', () => {
  initMap();
  renderQuickGrid();
  renderStops();
});