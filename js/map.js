// =====================
// 1. Create map
// =====================
const map = L.map('map').setView([-33.8705, 150.8954], 11);

// Create labels pane
map.createPane('basePane'); map.getPane('basePane').style.zIndex = 200;
map.createPane('contourPane'); map.getPane('contourPane').style.zIndex = 450;
map.createPane('stormwaterPane'); map.getPane('stormwaterPane').style.zIndex = 460;
map.createPane('cadastrePane'); map.getPane('cadastrePane').style.zIndex = 470;
map.createPane('labelsPane'); map.getPane('labelsPane').style.zIndex = 650;
map.getPane('labelsPane').style.pointerEvents = 'none';
map.createPane('contourLabelPane'); map.getPane('contourLabelPane').style.zIndex = 500; 
map.getPane('contourLabelPane').style.pointerEvents = 'none';
map.createPane('drawPane'); map.getPane('drawPane').style.zIndex = 700;
map.createPane('boundaryPane'); map.getPane('boundaryPane').style.zIndex = 800;
map.getPane('boundaryPane').style.pointerEvents = 'none';

let cadastreLayers = [];
let stormwaterLayers = [];
let contourLayers = [];

//escape function
function escapeHTML(str) {
  if (typeof str !== 'string') return str;

  return str.replace(/[&<>"']/g, function (tag) {
    const chars = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return chars[tag] || tag;
  });
}

function rebuildCadastreLayerIndex() {
  cadastreLayers = [];
  
    function collectPolygonLayers(layer) {
    if (layer.feature?.geometry?.type === 'Polygon' || layer.feature?.geometry?.type === 'MultiPolygon') {
      cadastreLayers.push(layer);
      return;
    }

    if (typeof layer.eachLayer === 'function') {
      layer.eachLayer(collectPolygonLayers);
    }
  }

  cadastreLayer.eachLayer(collectPolygonLayers);
}

// =====================
// Map attribution
// =====================
// OpenStreetMap
const osm = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    pane: 'basePane',
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">' +
      'OpenStreetMap contributors</a>'
  }
);

// OSM Dark Mode
var Carto_Dark = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/" target="_blank">CARTO</a>'
  }
);

// Esri global satellite
const esriSatellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/' +
  'World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    pane: 'basePane',
    attribution:
      'Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> | ' +
      'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  }
);

// NSW SixMaps imagery (current)
const nswImageryCurrent = L.tileLayer(
  'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    pane: 'basePane',
    attribution:
      '© State of New South Wales (Spatial Services, a business unit of the Department of Customer Service NSW). ' +
      'For current information go to ' +
      '<a href="https://www.spatial.nsw.gov.au" target="_blank" rel="noopener">' +
      'spatial.nsw.gov.au</a>',
    maxZoom: 21
  }
);

// NSW SixMaps historical imagery (free/public) merged into NSW Imagery layer
const SIXMAPS_IMAGERY_VINTAGES = [
  'Latest',
  2024, 2020, 2013, 2005, 2004, 1991, 1986, 1984, 1983,
  1978, 1975, 1973, 1972, 1965, 1943
];
const SIXMAPS_IMAGERY_DEFAULT_VINTAGE = 'Latest';
const SIXMAPS_IMAGERY_DEFAULT_HISTORICAL_YEAR = 1943;
const SIXMAPS_IMAGERY_NUMERIC_YEARS = SIXMAPS_IMAGERY_VINTAGES.filter(v => typeof v === 'number');
const SIXMAPS_IMAGERY_MIN_INPUT_YEAR = Math.min(...SIXMAPS_IMAGERY_NUMERIC_YEARS);

function toSixmapsWmsTimeRange(year) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  return { start, end };
}

const sixmapsHistorical = L.esri.dynamicMapLayer({
  url: 'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/ImageServer',
  pane: 'basePane',
  layers: [0],
  opacity: 1,
  useCors: true,
  disableCache: true,
  attribution:
    '© State of New South Wales (Spatial Services, a business unit of the Department of Customer Service NSW). ' +
    'Historical imagery served by SixMaps.'
});

const defaultHistoricalRange = toSixmapsWmsTimeRange(SIXMAPS_IMAGERY_DEFAULT_HISTORICAL_YEAR);
sixmapsHistorical.setTimeRange(defaultHistoricalRange.start, defaultHistoricalRange.end);

const nswImagery = L.layerGroup([sixmapsHistorical]);

function setNswImageryVintage(vintage) {
  nswImagery.clearLayers();

  if (vintage === 'Latest') {
    nswImagery.addLayer(nswImageryCurrent);
    return;
  }

  sixmapsHistorical.setDynamicLayers([
    {
      id: 0,
      source: {
        type: "mapLayer",
        mapLayerId: 0
      },
      definitionExpression: `ImageYear = ${vintage}`
    }
  ]);

  nswImagery.addLayer(sixmapsHistorical);
}

setNswImageryVintage(SIXMAPS_IMAGERY_DEFAULT_VINTAGE);

let historicalYearSlider = null;
let historicalYearInput = null;
let historicalYearValue = null;

function updateHistoricalControlOptions() {
  if (!historicalYearSlider || !historicalYearValue) return;

  historicalYearSlider.max = String(SIXMAPS_IMAGERY_VINTAGES.length - 1);

  const hasDefault = SIXMAPS_IMAGERY_VINTAGES.includes(SIXMAPS_IMAGERY_DEFAULT_VINTAGE);
  const selectedVintage = hasDefault ? SIXMAPS_IMAGERY_DEFAULT_VINTAGE : SIXMAPS_IMAGERY_VINTAGES[0];
  historicalYearSlider.value = String(SIXMAPS_IMAGERY_VINTAGES.indexOf(selectedVintage));
  historicalYearValue.textContent = String(selectedVintage);
  
  if (historicalYearInput) {
    historicalYearInput.value = selectedVintage === 'Latest' ? '' : String(selectedVintage);
  }
}

function applyManualHistoricalYear(rawYear) {
  const year = Number(rawYear);
  if (!Number.isFinite(year)) return;

  const historicalYears = SIXMAPS_IMAGERY_VINTAGES.filter(v => typeof v === 'number');
  if (!historicalYears.length) return;

  const nearestYear = historicalYears.reduce((closest, current) => {
    return Math.abs(current - year) < Math.abs(closest - year) ? current : closest;
  }, historicalYears[0]);

  const yearIndex = SIXMAPS_IMAGERY_VINTAGES.indexOf(nearestYear);
  if (historicalYearSlider && yearIndex >= 0) {
    historicalYearSlider.value = String(yearIndex);
  }
  historicalYearValue.textContent = String(nearestYear);
  if (historicalYearInput) historicalYearInput.value = String(nearestYear);
  setNswImageryVintage(nearestYear);
}

// Nearmap Simple WMS
const NEARMAP_WMS_ENDPOINT = 'https://summer-cloud-a5f2.d-pipatvong.workers.dev/nearmap/wms';
const NEARMAP_WMS_LAYER = 'Nearmap/Nearmap/Australia'; //this is correct, not Vert

const nearmapBaseParams = {
  pane: 'basePane',
  format: 'image/jpeg',
  transparent: false,
  version: '1.1.1',
  layers: NEARMAP_WMS_LAYER,
  attribution:
    '© <a href="https://www.nearmap.com" target="_blank" rel="noopener">Nearmap</a>',
  maxZoom: 22,
};

const nearmap = L.tileLayer.wms(NEARMAP_WMS_ENDPOINT, nearmapBaseParams);

//====================
// Tile Layers
//====================
// Transparent labels - Esri
const esriRoadLabels = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
  {
    attribution:
      'Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> | ' +
      'Tiles © Esri — Source: Esri, Garmin, HERE, UNIGIS',
    pane: 'labelsPane',
    maxZoom: 23
  }
);

// Hybrid layer
const nswHybrid = L.layerGroup([
  nearmap,
  esriRoadLabels
]);

const baseMaps = {
  "🗺️ Street Map": osm,
  "🌑 Dark Mode": Carto_Dark,
  "🛰️ NSW Imagery": nswImagery,
  "🛰️ Nearmap Hybrid (Imagery + Labels)": nswHybrid,
  "🛰️ Satellite (Esri)": esriSatellite
};

L.control.layers(baseMaps, null, {
  position: 'topright',
  collapsed: true
}).addTo(map);

nswHybrid.addTo(map);

//dark mode
function syncDarkModeClass(layerName) {
  document.body.classList.toggle("dark-mode", layerName === "🌑 Dark Mode");
}

const historicalControl = L.control({ position: 'bottomright' });

historicalControl.onAdd = function () {
  const container = L.DomUtil.create('div', 'leaflet-bar sixmaps-historical-control');
  container.innerHTML = `
    <div class="historical-control-card">
      <strong>NSW Imagery Vintage</strong>
      <div class="historical-year-row">
        <label for="historical-year-slider">Year:</label>
        <span id="historical-year-value">${SIXMAPS_IMAGERY_DEFAULT_VINTAGE}</span>
      </div>
      <input id="historical-year-slider" type="range" min="0" max="${SIXMAPS_IMAGERY_VINTAGES.length - 1}" step="1" value="${SIXMAPS_IMAGERY_VINTAGES.indexOf(SIXMAPS_IMAGERY_DEFAULT_VINTAGE)}" aria-label="SixMaps historical year slider" />
      <div class="historical-manual-row">
        <input id="historical-year-input" type="number" min="1943" placeholder="Type year" />
        <button id="historical-year-apply" type="button">Go</button>
      </div>
      <small>Latest uses NSW Imagery; other years use free SixMaps historical imagery.</small>
    </div>
  `;

  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);

  historicalYearSlider = container.querySelector('#historical-year-slider');
  historicalYearInput = container.querySelector('#historical-year-input');
  const historicalYearApply = container.querySelector('#historical-year-apply');
  historicalYearValue = container.querySelector('#historical-year-value');

  historicalYearSlider.addEventListener('input', (event) => {
    const selectedVintage = SIXMAPS_IMAGERY_VINTAGES[Number(event.target.value)];
    historicalYearValue.textContent = selectedVintage;
    if (historicalYearInput) {
      historicalYearInput.value = selectedVintage === 'Latest' ? '' : String(selectedVintage);
    }
    setNswImageryVintage(selectedVintage);
  });

  historicalYearApply.addEventListener('click', () => {
    applyManualHistoricalYear(historicalYearInput?.value);
  });

  historicalYearInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyManualHistoricalYear(historicalYearInput?.value);
  });

  updateHistoricalControlOptions();

  return container;
};

historicalControl.addTo(map);

function toggleHistoricalControl(layerName) {
  const container = document.querySelector('.sixmaps-historical-control');
  if (!container) return;
  container.style.display = layerName === '🛰️ NSW Imagery' ? 'block' : 'none';
}

// Keep UI theme in sync with selected basemap
map.on('baselayerchange', function (e) {
  syncDarkModeClass(e.name);
  toggleHistoricalControl(e.name);
});

// Ensure initial theme matches the default basemap
syncDarkModeClass("🛰️ Nearmap Hybrid (Imagery + Labels)");
toggleHistoricalControl("🛰️ Nearmap Hybrid (Imagery + Labels)");

//================
// Search Bar
// Keep a reference to the search marker
let searchMarker = null;

// Address search via Cloudflare Worker
async function searchAddress(query) {
  query = query.trim();
  if (!query) return;

  let results = [];

  try {
    const res = await fetch(`https://broken-mode-a4aa.d-pipatvong.workers.dev/?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    results = (data.features || []).map(f => ({
      name: f.place_name,
      center: [f.center[1], f.center[0]] // [lat, lng]
    }));
  } catch (err) {
    console.error("Address search failed", err);
  }

  // Show marker if found
  if (results.length) {
    const { name, center } = results[0];

    if (searchMarker) map.removeLayer(searchMarker);
    searchMarker = L.marker(center).addTo(map).bindPopup(name).openPopup();
    map.setView(center, 18);
  }

  return results.length > 0;
}

    // Search Job IDs
function searchJobIDs(query) {
  const lowerQuery = query.trim().toLowerCase();
  let foundLayers = [];   

  Object.keys(jobLayers).forEach(utility => {
    Object.keys(jobLayers[utility]).forEach(jobId => {
      if (jobId.toLowerCase().includes(query)) {
        const group = jobLayers[utility][jobId];

        if (!map.hasLayer(group)) map.addLayer(group);

        group.eachLayer(layer => {
          foundLayers.push(layer)
          if (layer.setStyle) {
            layer.setStyle({ weight: 6 });
            setTimeout(() => {
              applyUtilityStyle(
                layer,
                layer.feature.properties.utility,
                layer.feature.properties.sublayer
              );
            }, 1500);
          }
        });
      }
    });
  });

  // If Job found → zoom to it
  if (foundLayers.length) {
    const group = L.featureGroup(foundLayers);
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  }
  
  return foundLayers.length > 0;
}

//======
const geocoder = L.Control.geocoder({
  position: 'topleft',
  placeholder: 'Search address or Job ID…',
  suggestMinLength: 3,
  suggestTimeout: 250,
  defaultMarkGeocode: false,
  autocomplete: false //reduce request
}).addTo(map);

geocoder.on('startgeocode', async function(e) {
  const query = e.input.trim();
  if (!query) return;

  // 1️⃣ Try address search via Worker
  const foundAddress = await searchAddress(query);

  // 2️⃣ If no address found, try Job IDs
  if (!foundAddress) {
    const foundJobs = searchJobIDs(query);
    if (!foundJobs) console.log("No address or Job ID found");
  }
});

// =====================
// 2. Load Fairfield LGA boundary
// =====================
let boundary = null;
fetch('data/fairfield_lga.geojson')
  .then(res => {
    if (!res.ok) throw new Error('GeoJSON not found');
    return res.json();
  })
  .then(geojson => {
    console.log('Boundary loaded');

    boundary = L.geoJSON(geojson, {
      pane: 'boundaryPane',
      smoothFactor: 0,
      style: {
        color: 'red',
        weight: 3,
        fill: false
      }
    }).addTo(map);
    
  })
  .catch(err => {
    console.error('Boundary load failed:', err);
  });

// =====================
// 3. Create utility layers
// =====================
const roadworksLayer = new L.FeatureGroup();
const waterLayer = new L.FeatureGroup();
const electricityLayer = new L.FeatureGroup();
const gasLayer = new L.FeatureGroup();
const telecommunicationsLayer = new L.FeatureGroup();
const stormwaterLayer = new L.FeatureGroup();

// =====================
// SIX Maps cadastre layer
// =====================
const cadastreLayer = new L.FeatureGroup();
const cadastreLabelLayer = new L.FeatureGroup();
let cadastreLoaded = false;
let cadastreLoadingPromise = null;
let easementsLoaded = false;

// =====================
// 3.1 DEM Contours Layer
// =====================
const demContoursLayer = new L.FeatureGroup();

let demContoursLoaded = false;
let demContoursLoaded2m = false;
let demContoursLoaded1m = false;

let contourLabelData = []

function getFlatLatLngs(layer) {
  let latlngs = layer.getLatLngs();
  latlngs = L.LineUtil.isFlat(latlngs) ? latlngs : latlngs.flat();
  return latlngs || [];
}

function getLabelAnchorAndAngle(latlngs) {
  if (!latlngs.length) return null;

  if (latlngs.length === 1) {
    return {
      latlng: latlngs[0],
      angleDeg: 0
    };
  }

  const midIndex = Math.floor((latlngs.length - 1) / 2);
  const p1 = latlngs[midIndex];
  const p2 = latlngs[Math.min(midIndex + 1, latlngs.length - 1)];

  const dx = p2.lng - p1.lng;
  const dy = p2.lat - p1.lat;

  let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

  // Keep text upright
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg < -90) angleDeg += 180;

  return {
    latlng: latlngs[midIndex],
    angleDeg
  };
}


// Function to load contour file
function loadContours(url, targetLayer, callback) {

  fetch(url)
    .then(res => res.json())
    .then(geojson => {

      const contours = L.geoJSON(geojson, {
        pane: 'contourPane',
        interactive: true,
        renderer: L.canvas({ padding: 0.5 }),
        style: feature => {
          const level = feature.properties.Level;
          
          // Default 1m
          let color = 'oklch(70% 0.15 240)';
          let weight = 1.5;
          let opacity = 0.75;

          // Every 2m stronger
          if (level % 2 === 0) {
            color = 'oklch(60% 0.18 240)';
            weight = 2;
            opacity = 0.85;
          }

          // Every 10m = index contour
          if (level % 10 === 0) {
            color = 'oklch(45% 0.15 240)';
            weight = 3;
            opacity = 1;
          }

          return { color, weight, opacity,
            smoothFactor: 0
           };
        },

        onEachFeature: function(feature, layer) {

          if (feature.properties && feature.properties.Level == null) return;

          const level = feature.properties.Level;

          // Invisible click buffer (easy clicking)
          const clickBuffer = L.polyline(layer.getLatLngs(), {
            weight: 10,
            opacity: 0,
            interactive: true,
            pane: 'contourPane'
          }).addTo(demContoursLayer);

          clickBuffer.on('click', function(e) {
            L.popup({
              closeButton: true,
              autoClose: true,
              className: 'contour-popup'
            })
            .setLatLng(e.latlng)
            .setContent(`<strong>${level.toFixed(1)} m</strong>`)
            .openOn(map);
          });
        }
      });

      demContoursLayer.addLayer(contours);
      // Precompute label positions once (FAST)
      contourLabelData = [];

      contours.eachLayer(layer => {
        if (!layer.feature) return;

        const elevation = layer.feature.properties.Level;
        if (elevation == null) return;

        const latlngs = getFlatLatLngs(layer);
        if (!latlngs.length) return;

        const labelInfo = getLabelAnchorAndAngle(latlngs);
        if (!labelInfo) return;

        contourLabelData.push({
          latlng: labelInfo.latlng,
          elevation: elevation,
          angleDeg: labelInfo.angleDeg
        });
      });

      // draw once after load
      drawContourLabelsCanvas();

      if (callback) callback();
    })
    .catch(console.error);

}

function drawContourLabelsCanvas() {

  const renderer = demContoursLayer._renderer;
  if (!renderer || !renderer._ctx) return;

  const ctx = renderer._ctx;
  const bounds = map.getBounds();
  const interval = getLabelInterval();

  ctx.save();

  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "black";

  contourLabelData.forEach(label => {

    if (Math.round(label.elevation) % interval !== 0) return;
    if (!bounds.contains(label.latlng)) return;

    const point = map.latLngToContainerPoint(label.latlng);

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate((label.angleDeg || 0) * Math.PI / 180);

    const text = label.elevation.toFixed(1) + " m";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
   });
    ctx.restore();
  }

function getLabelInterval() {
  const zoom = map.getZoom();
  if (zoom >= 17) return 1;   // close → 1m
  if (zoom >= 15) return 5;   // medium → 5m
  return 10;                  // far → 10m
}

//==========
//map on click for cadastre, stormwater, contour
//==========
map.on('click', function (e) {

  const latlng = e.latlng;

  // 1️⃣ Check utilities FIRST (so edit works properly)
  let clickedUtility = null;

  drawnItems.eachLayer(layer => {
    if (layer.getBounds && layer.getBounds().contains(latlng)) {
      clickedUtility = layer;
    }
  });

  if (clickedUtility) {
    clickedUtility.openPopup();
    return;
  }

  // 2️⃣ Stormwater
  for (let layer of stormwaterLayers) {
    if (layer.getBounds && layer.getBounds().contains(latlng)) {
      layer.openPopup();
      return;
    }
  }

  // 3️⃣ Cadastre (only when layer is visible)
  if (map.hasLayer(cadastreLayer)) {
    for (let layer of cadastreLayers) {
      if (layer.getBounds && layer.getBounds().contains(latlng)) {
        if (layer.getPopup()) layer.openPopup();
        return;
      }
    }
  }
  
});


// GDA94 / MGA Zone 56 (NSW)
const MGA56 = '+proj=utm +zone=56 +south +datum=GDA94 +units=m +no_defs';

let stormwaterLoaded = false;
let stormwaterGeoJsonLayer = null;

// dynamic job sublayers container
const jobLayers = {
  roadworks: {},
  water: {},
  electricity: {},
  gas: {},
  telecommunications: {}
};

//=============
// Enhanced layerConfig with sublayers
//=============
const layerConfig = {
    roadworks: {
    group: roadworksLayer,
    color: 'oklch(75% 0.18 70)',   // Orange (#FFA500)
    sublayers: {
      'FY26-27': new L.FeatureGroup(),
      'FY27-28': new L.FeatureGroup(),
      'FY28-29': new L.FeatureGroup()
    }
  },
    stormwater: { 
    group: stormwaterLayer, 
    color: 'oklch(75% 0.14 200)',  // Cyan (#00CED1)
  },
  water: { 
    group: waterLayer, 
    color: 'oklch(60% 0.16 250)',  // Blue (#0074C8)
     },
  electricity: { 
    group: electricityLayer, 
    color: 'oklch(62% 0.25 29)',   // Red (#FF0000)
    sublayers: {
      overhead: new L.FeatureGroup(),
      underground: new L.FeatureGroup(),
      substation: new L.FeatureGroup()
    }
  },
  gas: { 
    group: gasLayer, 
    color: 'oklch(85% 0.18 100)',  // Yellow (#FFD700)
    sublayers: {
      transmission: new L.FeatureGroup(),
      distribution: new L.FeatureGroup(),
      emergency: new L.FeatureGroup()
    }
  },
  telecommunications: { 
    group: telecommunicationsLayer, 
    color: 'oklch(55% 0.18 142)',  // Green
    sublayers: {
      'Telstra': new L.FeatureGroup(),
      'NBN': new L.FeatureGroup(),
      'Optus': new L.FeatureGroup(),
      'Other': new L.FeatureGroup()
    }
  }
};


// Add sublayers to their parent groups
Object.values(layerConfig).forEach(config => {
  if (config.sublayers) {
    Object.values(config.sublayers).forEach(sublayer => {
      config.group.addLayer(sublayer);
    });
  }
});

// ========
// Utility Buttons (Merged & Clean)
// ========
let activeUtility = "roadworks";
let activeRoadworksSublayer = 'FY26-27';
let activeTelecomSublayer = 'Telstra';

// Ensure drawnItems always stays on top
const drawnItems = new L.FeatureGroup();
map.createPane('drawPane');
map.getPane('drawPane').style.zIndex = 1000;
drawnItems.options.pane = 'drawPane';
map.addLayer(drawnItems);

const buttons = document.querySelectorAll('#controls button[data-layer]');
const roadworksSubmenu = document.getElementById('roadworks-submenu');
const telecomSubmenu = document.getElementById('telecom-submenu');

buttons.forEach(button => {
  button.addEventListener('click', () => {
    const utility = button.dataset.layer;

    // 1️⃣ Highlight clicked main button, remove others
    buttons.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#roadworks-submenu button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#telecom-submenu button').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    activeUtility = utility;

    // 2️⃣ Show/hide submenus
    roadworksSubmenu.style.display = (utility === 'roadworks') ? 'block' : 'none';
    telecomSubmenu.style.display = (utility === 'telecommunications') ? 'block' : 'none';

    // 4️⃣ Re-add drawnItems so it stays on top
    if (!map.hasLayer(drawnItems)) map.addLayer(drawnItems);

    // 5️⃣ Set default sublayer
    if (utility === 'roadworks') setRoadworksSublayer(activeRoadworksSublayer);
    if (utility === 'telecommunications') setTelecomSublayer(activeTelecomSublayer);
  });
});

// ========
// Roadworks sublayer function
// ========
const roadworksColors = {
  'FY26-27': 'oklch(75% 0.18 70)',  // base orange
  'FY27-28': 'oklch(80% 0.17 70)',  // slightly lighter
  'FY28-29': 'oklch(82% 0.16 70)'   // soft light orange
};

// Sublayer function
function setRoadworksSublayer(name) {
  const sublayers = layerConfig.roadworks.sublayers;

  // Ensure main roadworks button is active
  document.getElementById('roadworks-btn').classList.add('active');

  // Clear all sublayer button highlights
  document.querySelectorAll('#roadworks-submenu button').forEach(btn =>
    btn.classList.remove('active')
  );

  // Highlight the selected sublayer
  document.getElementById(`rw-${name}`).classList.add('active');

  // Add all sublayers to the map and style them
  Object.entries(sublayers).forEach(([key, fg]) => {
    if (!map.hasLayer(fg)) map.addLayer(fg);

    fg.eachLayer(layer => {
      if (layer.setStyle) {
        layer.setStyle({
          color: roadworksColors[key], // use FY-specific color
          opacity: 1
        });
      }
    });
  });

  // Track the currently active FY for UI purposes
  activeRoadworksSublayer = name;
}

// ========
// Telecom sublayer function
// ========
const telecomColors = {
  'Telstra': 'oklch(55% 0.18 142)',  // deep green
  'NBN':     'oklch(65% 0.16 145)',  // standard green
  'Optus':   'oklch(72% 0.17 150)',  // brighter green
  'Other':   'oklch(68% 0.10 160)'   // softer green-teal
};

function setTelecomSublayer(name) {

  const sublayers = layerConfig.telecommunications.sublayers;

  // Switch active utility
  activeUtility = 'telecommunications';


  // Highlight main telecom button
  document.getElementById('telecom-btn').classList.add('active');

  // Clear sublayer button highlights
  document.querySelectorAll('#telecom-submenu button')
    .forEach(btn => btn.classList.remove('active'));

  // Highlight selected provider
  document.getElementById(`tc-${name}`).classList.add('active');

  // Remove ALL telecom provider layers
  Object.values(sublayers).forEach(fg => {
    if (map.hasLayer(fg)) map.removeLayer(fg);
  });

  // Add only selected provider layer
  const selectedLayer = sublayers[name];
  map.addLayer(selectedLayer);

  // Apply provider color
  selectedLayer.eachLayer(layer => {
    if (layer.setStyle) {
      layer.setStyle({
        color: telecomColors[name],
        opacity: 1
      });
    }
  });

  activeTelecomSublayer = name;
}


// Layer control
const overlayLayers = {
  'Cadastre': cadastreLayer,
  'Contours': demContoursLayer, 
  'Roadworks': roadworksLayer,
  'Stormwater': stormwaterLayer,
  'Water': waterLayer,
  'Electricity': electricityLayer,
  'Gas': gasLayer,
  'Telecommunications': telecommunicationsLayer,
};

const sublayerControls = {
  'Roadworks Sublayers': {
    'FY26-27': layerConfig.roadworks.sublayers['FY26-27'],
    'FY27-28': layerConfig.roadworks.sublayers['FY27-28'],
    'FY28-29': layerConfig.roadworks.sublayers['FY28-29']
  },
  'Telecommunications Sublayers': {
    'Telstra': layerConfig.telecommunications.sublayers['Telstra'],
    'NBN': layerConfig.telecommunications.sublayers['NBN'],
    'Optus': layerConfig.telecommunications.sublayers['Optus'],
    'Other': layerConfig.telecommunications.sublayers['Other']
  }
};

// Create layer controls
const baseLayerControl = L.control.layers(null, overlayLayers).addTo(map);

// Add sublayer controls
Object.entries(sublayerControls).forEach(([groupName, sublayers]) => {
  L.control.layers(null, sublayers, {
    collapsed: false,
    position: 'topright'
  }).addTo(map);
});

// Stormwater attribute table
function buildAttributeTable(properties = {}) {
  return `
    <table class="popup-table">
      <tbody>
        ${Object.entries(properties).map(([key, value]) => `
          <tr>
            <td class="key">${escapeHTML(key)}</td>
            <td class="value">${escapeHTML(String(value ?? ''))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Track which roadworks sublayer is active
map.on('overlayadd', e => {
  console.log("Overlay fired:", e.layer);
  console.log("Stormwater ref:", stormwaterLayer);
  // Track roadworks sublayer
  Object.entries(layerConfig.roadworks.sublayers).forEach(([key, layer]) => {
    if (e.layer === layer) {
      activeRoadworksSublayer = key;
    }
  });

  // Load cadastre when toggled
  if (e.layer === cadastreLayer) {
    loadCadastre();
  }

  // Load stormwater when toggled
  if (e.layer === stormwaterLayer) {

    if (stormwaterLoaded) return;

    
    const isMobile = L.Browser.mobile;
    // Create shared canvas renderer
    const canvasRenderer = L.canvas({
      padding: isMobile ? 0 : 0.5
    });

    fetch('data/stormwater.geojson')
      .then(res => res.json())
      .then(geojson => {

          stormwaterLayers = [];
          
          stormwaterGeoJsonLayer = L.geoJSON(null, {
            pane: 'stormwaterPane',
            interactive: true,
            renderer: canvasRenderer,
            style: {
              color: layerConfig.stormwater.color,
              weight: isMobile ? 1.2 : 2,
              opacity: 0.8
            },

            pointToLayer: (feature, latlng) =>
              L.circleMarker(latlng, {
                renderer: canvasRenderer,
                radius: isMobile ? 8 : 15,
                color: layerConfig.stormwater.color,
                fillOpacity: 0.8,
                interactive: true
              }),

            onEachFeature: (feature, layer) => {
              layer.bindPopup(
                buildAttributeTable(feature.properties || {})
              );
            }
          });

          const refreshStormwater = () => {
            stormwaterGeoJsonLayer.clearLayers();

            if (!isMobile || map.getZoom() >= 14) {
              stormwaterGeoJsonLayer.addData(geojson);
            }
          };

          stormwaterLayer.addLayer(stormwaterGeoJsonLayer);

          refreshStormwater();

          if (isMobile) {
            map.on('zoomend', refreshStormwater);
          }

          stormwaterGeoJsonLayer.eachLayer(layer => {
            stormwaterLayers.push(layer);
          })
          stormwaterLoaded = true;

          console.log("Stormwater loaded (Canvas + Mobile Zoom Filter)");
        })
      .catch(console.error);
  }

if (e.layer === demContoursLayer) {
  map.attributionControl.addAttribution(
    'Elevation data © Commonwealth of Australia (Geoscience Australia) – ELVIS'
  );


  if (!demContoursLoaded2m) {
    loadContours('https://soft-credit-c195.d-pipatvong.workers.dev/contour_2m.geojson', demContoursLayer, () => {
      demContoursLoaded2m = true;
      console.log("2m DEM loaded");
    });
  }
}
});

map.on('zoomend', function() {

  if (!map.hasLayer(demContoursLayer)) return;

  const zoom = map.getZoom();

  if (zoom >= 19 && !demContoursLoaded1m) {

    loadContours('https://soft-credit-c195.d-pipatvong.workers.dev/contour_1m.geojson', demContoursLayer, () => {
      demContoursLoaded1m = true;
      console.log("1m DEM loaded");
    });
  }
});

// =====================
// Function to add features to specific sublayer
// =====================
function addToSublayer(utilityType, sublayerName, feature) {
  if (layerConfig[utilityType] && layerConfig[utilityType].sublayers[sublayerName]) {
    feature.addTo(layerConfig[utilityType].sublayers[sublayerName]);
  }
}

// =====================
// Roadworks sublayer buttons
// =====================
document.getElementById('rw-FY26-27')
  .addEventListener('click', () => setRoadworksSublayer('FY26-27'));
document.getElementById('rw-FY27-28')
  .addEventListener('click', () => setRoadworksSublayer('FY27-28'));
document.getElementById('rw-FY28-29')
  .addEventListener('click', () => setRoadworksSublayer('FY28-29'));

// =====================
// Telecomms sublayer buttons
// =====================
document.getElementById('tc-Telstra')
.addEventListener('click', () => setTelecomSublayer('Telstra'));
document.getElementById('tc-NBN')
.addEventListener('click', () => setTelecomSublayer('NBN'));
document.getElementById('tc-Optus')
.addEventListener('click', () => setTelecomSublayer('Optus'));
document.getElementById('tc-Other')
.addEventListener('click', () => setTelecomSublayer('Other'));


// =====================
// 5. Draw control
// =====================
const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems,
    remove: true,    // enable trash icon
    edit: true
  },
  draw: {
    polygon: true,
    polyline: true,
    rectangle: true,
    marker: true,
    circle: false
  }
});

map.addControl(drawControl);

function snapshotLayerForUndo(layer) {
  if (!layer) return null;

  const feature = layer.toGeoJSON();
  feature.properties = { ...(layer.feature?.properties || feature.properties || {}) };

  return feature;
}

function restoreFeatureFromUndo(feature) {
  const utility = feature.properties?.utility;
  const jobId = feature.properties?.jobId;
  const sublayerName = feature.properties?.sublayer || '';

  if (!utility || !jobId || !layerConfig[utility]) return;

  if (!jobLayers[utility]) jobLayers[utility] = {};

  if (!jobLayers[utility][jobId]) {
    jobLayers[utility][jobId] = new L.FeatureGroup();
    layerConfig[utility].group.addLayer(jobLayers[utility][jobId]);
  }

  L.geoJSON(feature).eachLayer(layer => {
    layer._utility = utility;
    layer._currentJobId = jobId;
    layer._sublayer = sublayerName;

    drawnItems.addLayer(layer);
    jobLayers[utility][jobId].addLayer(layer);
    applyUtilityStyle(layer, utility, sublayerName);
    attachPopupHandlers(layer);
  });
}

function restoreDeletedBatch(batch) {
  if (!Array.isArray(batch) || !batch.length) return;

  const affectedUtilities = new Set();

  batch.forEach(feature => {
    const utility = feature?.properties?.utility;
    restoreFeatureFromUndo(feature);
    if (utility) affectedUtilities.add(utility);
  });

  affectedUtilities.forEach(u => updateJobList(u));
}


map.on('draw:deletestart', function () {
  const confirmed = confirm('Delete mode enabled. Click a shape to delete it.');
  if (!confirmed) {
    drawControl._toolbars.edit._modes.remove.handler.disable();
  }
});

// Call toggleDrawLayer(true) to show, false to hide
function toggleDrawLayer(show) {
  if (show) {
    // Add back to map if hidden
    if (!map.hasLayer(drawnItems)) map.addLayer(drawnItems);
  } else {
    // Hide layer
    if (map.hasLayer(drawnItems)) map.removeLayer(drawnItems);
  }
}
// ---------------------
// Optional: Listen to delete events
map.on('draw:deleted', function (e) {

  const affectedUtilities = new Set();
  const deletedBatch = [];

  e.layers.eachLayer(layer => {

    const utility = layer.feature?.properties?.utility;
    const jobId   = layer._currentJobId || layer.feature?.properties?.jobId;

    if (!utility || !layerConfig[utility]) return;
    const config = layerConfig[utility];

    const snapshot = snapshotLayerForUndo(layer);
    if (snapshot) deletedBatch.push(snapshot);

    // 1️⃣ Remove from drawnItems
    if (drawnItems.hasLayer(layer)) drawnItems.removeLayer(layer);

    // 2️⃣ Remove from main utility group
    if (config.group.hasLayer(layer)) config.group.removeLayer(layer);

    // 3️⃣ Remove from all sublayers
    if (config.sublayers) {
      Object.values(config.sublayers).forEach(sub => {
        if (sub.hasLayer(layer)) sub.removeLayer(layer);
      });
    }

    // 4️⃣ Remove from job group
    if (jobId && jobLayers[utility]?.[jobId]?.hasLayer(layer)) {
      jobLayers[utility][jobId].removeLayer(layer);

      // Delete empty job group
      if (jobLayers[utility][jobId].getLayers().length === 0) {
        delete jobLayers[utility][jobId];
      }
    }

    // 5️⃣ Remove job button from UI if job group deleted
    if (!jobLayers[utility]?.[jobId]) {
      const utilitySection = document.querySelector(`[data-utility="${utility}"]`);
      if (utilitySection) {
        const buttons = utilitySection.querySelectorAll('.job-items button');
        buttons.forEach(btn => {
          if (btn.textContent === jobId) btn.remove();
        });
      }
    }

    // 6️⃣ Track affected utility for UI update
    affectedUtilities.add(utility);

    // 7️⃣ Clean up reference
    layer._currentJobId = null;
  });

  if (deletedBatch.length) deletedFeatureStack.push(deletedBatch);

  affectedUtilities.forEach(u => updateJobList(u));
});

// =====================
// 6. Draw Handler
// =====================
map.on(L.Draw.Event.CREATED, e => {
  const layer = e.layer;

  // 1. Ensure a utility is selected
  const config = layerConfig[activeUtility];
  if (!config) {
    alert("Select a utility first");
    return;
  }

  // 2. Prompt for Job ID
  let jobId = prompt("Enter Job ID (max 30 characters):");
  if (!jobId) return alert("Job ID is required");
  // Trim whitespace and limit length
  jobId = jobId.trim().slice(0, 30);

  // 3. Ensure job group exists
  if (!jobLayers[activeUtility][jobId]) {
    jobLayers[activeUtility][jobId] = new L.FeatureGroup();
    config.group.addLayer(jobLayers[activeUtility][jobId]);
  }

  // 4. Add feature to job group
  jobLayers[activeUtility][jobId].addLayer(layer);

  // 5. Add to visible sublayer if roadworks, otherwise main group
  if (activeUtility === 'roadworks') {
  layerConfig.roadworks.sublayers[activeRoadworksSublayer].addLayer(layer);
    if (layer.setStyle) {
      layer.setStyle({ color: roadworksColors[activeRoadworksSublayer] });
    }
  }
  else if (activeUtility === 'telecommunications') {
    layerConfig.telecommunications.sublayers[activeTelecomSublayer].addLayer(layer);
    if (layer.setStyle) {
      layer.setStyle({ color: telecomColors[activeTelecomSublayer] });
    }
  }
  else {
    if (layer.setStyle) {
      layer.setStyle({ color: config.color });
    }
  }

  // 6. Add to drawnItems for editing/deleting
  drawnItems.addLayer(layer);


  // 7. Create feature properties
  layer.feature = {
    type: 'Feature',
    geometry: layer.toGeoJSON().geometry,
    properties: {
      utility: activeUtility,
      jobId,
      sublayer:
        activeUtility === 'roadworks'
          ? activeRoadworksSublayer
          : activeUtility === 'telecommunications'
          ? activeTelecomSublayer
          : null,
      description: '',
      startDate: '',
      endDate: ''
    }
  };


  // 8. Calculate measurements
  if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
    // Line length in meters
    const latlngs = layer.getLatLngs();
    let distance = 0;
    for (let i = 1; i < latlngs.length; i++) {
      distance += latlngs[i - 1].distanceTo(latlngs[i]);
    }
    layer.feature.properties.length_m = distance.toFixed(2);
  }

  if (layer instanceof L.Polygon) {
    // Polygon area in m² (supports holes & multipolygons)
    const latlngsArray = layer.getLatLngs();
    let area = 0;

    latlngsArray.forEach(ring => {
      if (Array.isArray(ring[0])) {
        ring.forEach(subRing => {
          area += L.GeometryUtil.geodesicArea(subRing);
        });
      } else {
        area += L.GeometryUtil.geodesicArea(ring);
      }
    });

    layer.feature.properties.area_m2 = area.toFixed(2);
  }

  const openEdit = attachPopupHandlers(layer);

// Open in edit mode immediately after drawing
  setTimeout(() => {
    openEdit();
  }, 50);

  // 11. Update job list UI
  updateJobList(activeUtility);
});


// =====================
// 6.5. Update measurements on edit
// =====================
map.on(L.Draw.Event.EDITED, function (e) {
  e.layers.eachLayer(layer => {

    if (layer.feature) {
      layer.feature.geometry = layer.toGeoJSON().geometry;
    }

    const p = layer.feature.properties;

    if (layer instanceof L.Polygon) {
      const latlngs = layer.getLatLngs()[0];
      const area = L.GeometryUtil.geodesicArea(latlngs);
      p.area_m2 = area.toFixed(2);
    } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      const latlngs = layer.getLatLngs();
      let distance = 0;
      for (let i = 1; i < latlngs.length; i++) {
        distance += latlngs[i - 1].distanceTo(latlngs[i]);
      }
      p.length_m = distance.toFixed(2);
    }

    if (layer.isPopupOpen()) {
      attachPopupHandlers(layer);
      layer.openPopup();
    }
  });
});
//===========
//measure tool
//===========
let liveMeasureTooltip = null;
let activeDrawHandler = null;
const deletedFeatureStack = [];

map.on('draw:drawstart', function () {

  const drawToolbar = drawControl?._toolbars?.draw;
  if (drawToolbar?._modes) {
    activeDrawHandler = Object.values(drawToolbar._modes)
      .map(mode => mode.handler)
      .find(handler => handler?.enabled?.()) || null;
  }

  liveMeasureTooltip = L.tooltip({
    permanent: false,
    direction: 'top',
    offset: [0, -10]
  }).setContent('0 m');

});

map.on('draw:drawvertex', function (e) {
  const layer = e.layer; // Correct reference
  if (!layer) return;
  const latlngs = layer.getLatLngs();
  if (!latlngs || latlngs.length < 2) return;

  let text = "";

  if (layer instanceof L.Polygon) {
    const area = L.GeometryUtil.geodesicArea(latlngs[0] || latlngs);
    text = !isNaN(area)
      ? area > 10000
        ? (area / 10000).toFixed(2) + " ha"
        : area.toFixed(2) + " m²"
      : "Invalid Area";
  } else if (layer instanceof L.Polyline) {
    const length = L.GeometryUtil.length(layer);
    text = !isNaN(length)
      ? length > 1000
        ? (length / 1000).toFixed(2) + " km"
        : length.toFixed(2) + " m"
      : "Invalid Length";
  }

  liveMeasureTooltip
    .setContent(text)
    .setLatLng(latlngs[latlngs.length - 1]);

  if (!liveMeasureTooltip._map) {
    liveMeasureTooltip.addTo(map);
  }
});

map.on('draw:drawstop', function () {
  activeDrawHandler = null;

  if (liveMeasureTooltip) {
    map.removeLayer(liveMeasureTooltip);
    liveMeasureTooltip = null;
  }
});

// Keyboard shortcut: Ctrl/Cmd + Z
// - while drawing: undo last vertex
// - after deleting features: restore last deleted feature(s)
document.addEventListener('keydown', function (e) {
  const inTextField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)
    || e.target?.isContentEditable;

  if (inTextField) return;
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;

  if (activeDrawHandler && typeof activeDrawHandler.deleteLastVertex === 'function') {
    activeDrawHandler.deleteLastVertex();
    e.preventDefault();
    return;
  }

  const lastDeletedBatch = deletedFeatureStack.pop();
  if (lastDeletedBatch?.length) {
    restoreDeletedBatch(lastDeletedBatch);
    e.preventDefault();
  }
});

//=========
// Job list update (optimized)
//=========
function updateJobList(utilityToUpdate = null) {
  const container = document.getElementById('job-buttons');

  // =========================
  // FULL rebuild (initial load / file load only)
  // =========================
  if (!utilityToUpdate) {
    container.innerHTML = '';

    Object.keys(jobLayers).forEach(utility => {
      renderUtility(utility);
    });

    return;
  }

  // =========================
  // PARTIAL rebuild (one utility only)
  // =========================
  const existingSection = container.querySelector(
    `[data-utility="${utilityToUpdate}"]`
  );

  if (existingSection) {
    existingSection.remove();
  }

  renderUtility(utilityToUpdate);
}

function renderUtility(utility) {
  const container = document.getElementById('job-buttons');

  const group = document.createElement('div');
  group.className = 'job-group';
  group.dataset.utility = utility;

  // Header
  const header = document.createElement('div');
  header.className = 'job-header';

  const title = document.createElement('span');
  title.textContent = utility;

  const icon = document.createElement('span');
  icon.textContent = '►';

  header.appendChild(title);
  header.appendChild(icon);
  group.appendChild(header);

  // Job items
  const items = document.createElement('div');
  items.className = 'job-items';
  items.style.display = 'none';

  Object.keys(jobLayers[utility] || {}).forEach(jobId => {
    const row = document.createElement('div');
    row.className = 'job-row';

    const btn = document.createElement('button');
    btn.textContent = jobId;
    btn.dataset.job = jobId;
    btn.classList.add('job-toggle');

    btn.onclick = () => {
      const groupLayer = jobLayers[utility][jobId];

      if (map.hasLayer(groupLayer)) {
        map.removeLayer(groupLayer);
        btn.classList.remove('active');
      } else {
        map.addLayer(groupLayer);
        btn.classList.add('active');
      }
    };

    // 🔥 DELETE BUTTON
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('job-delete');
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/>
      </svg>
    `;
    deleteBtn.className = 'job-delete';

    deleteBtn.onclick = (e) => {
      e.stopPropagation(); // prevent toggle click

      const confirmed = confirm(`Delete Job "${jobId}" and all its features?`);
      if (!confirmed) return;

      deleteEntireJob(utility, jobId);
    };

    row.appendChild(btn);
    row.appendChild(deleteBtn);
    items.appendChild(row);
    
  });

  group.appendChild(items);

  // Expand / collapse
  header.onclick = () => {
    const isOpen = items.style.display === 'block';
    items.style.display = isOpen ? 'none' : 'block';
    icon.textContent = isOpen ? '►' : '▼';
  };

  container.appendChild(group);
}

function deleteEntireJob(utility, jobId) {

  const jobGroup = jobLayers[utility]?.[jobId];
  if (!jobGroup) return;

  jobGroup.eachLayer(layer => {

    // Remove from drawnItems
    if (drawnItems.hasLayer(layer)) {
      drawnItems.removeLayer(layer);
    }

    // Remove from sublayers
    if (layerConfig[utility]?.sublayers) {
      Object.values(layerConfig[utility].sublayers).forEach(sub => {
        if (sub.hasLayer(layer)) sub.removeLayer(layer);
      });
    }

    // Remove from map
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }

  });

  // Remove job group from main utility group
  layerConfig[utility].group.removeLayer(jobGroup);

  // Remove from storage
  delete jobLayers[utility][jobId];

  // Refresh UI
  updateJobList(utility);
}

// =====================
// 7. Popup & editing
// =====================
function attachPopupHandlers(layer) {

  const renderView = () => {
    const p = layer.feature.properties;
    let measurement = '';

    if (layer instanceof L.Polygon) {
      const latlngs = layer.getLatLngs()[0];
      const area = L.GeometryUtil.geodesicArea(latlngs);
      p.area_m2 = area.toFixed(2);
      measurement = area > 10000 ? (area / 10000).toFixed(2) + ' ha' : area.toFixed(2) + ' m²';
    } else if (layer instanceof L.Polyline) {
      const latlngs = layer.getLatLngs();
      let distance = 0;
      for (let i = 1; i < latlngs.length; i++) distance += latlngs[i-1].distanceTo(latlngs[i]);
      p.length_m = distance.toFixed(2);
      measurement = distance.toFixed(2) + ' m';
    }

    return `
      <div>
        <strong>Utility:</strong> ${escapeHTML(p.utility)}<br>
        <strong>Job ID:</strong> ${escapeHTML(p.jobId || '-')}<br>
        <strong>Description:</strong><br>${escapeHTML(p.description || '-')}<br>
        <strong>Start:</strong> ${escapeHTML(p.startDate || '-')}<br>
        <strong>End:</strong> ${escapeHTML(p.endDate || '-')}<br>
        <strong>Measurement:</strong> ${measurement}<br>
        <em>(Double-click to edit)</em>
      </div>`;
  };

  const renderEdit = () => {
    const p = layer.feature.properties;
    return `
      <div style="width:200px; max-width:200px; font-family:sans-serif; font-size:13px;">
        <div style="margin-bottom:8px;">
          <label>Job ID</label><br>
          <input id="jobId" type="text" maxlength="30" value="${escapeHTML(p.jobId || '')}" style="width:90%; padding:4px;">
        </div>
        <div style="margin-bottom:8px;">
          <label>Description</label><br>
          <textarea id="description" rows="3" style="width:90%; padding:4px;">${escapeHTML(p.description || '')}</textarea>
        </div>
        <div style="margin-bottom:8px;">
          <label>Start Date</label><br>
          <input id="startDate" type="date" value="${escapeHTML(p.startDate || '')}" style="width:90%; padding:4px;">
        </div>
        <div style="margin-bottom:12px;">
          <label>End Date</label><br>
          <input id="endDate" type="date" value="${escapeHTML(p.endDate || '')}" style="width:90%; padding:4px;">
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="save-btn">Save</button>
          <button class="delete-btn">Delete</button>
        </div>
      </div>`;
  };

  const openEdit = () => {
    layer.setPopupContent(renderEdit());
    layer.openPopup();

    const popupEl = layer.getPopup().getElement();
    const saveBtn = popupEl.querySelector('.save-btn');
    const deleteBtn = popupEl.querySelector('.delete-btn');

    saveBtn.onclick = () => {
      const p = layer.feature.properties;
      const utility = p.utility;

      // Trim and get new Job ID
      const newJobId = popupEl.querySelector('#jobId').value.trim().slice(0, 30);
      const oldJobId = p.jobId;

      // --- Handle Job ID change ---
      if (newJobId !== oldJobId) {
        // Remove from old group
        if (jobLayers[utility]?.[oldJobId]) {
          jobLayers[utility][oldJobId].removeLayer(layer);

          // Delete old group if empty
          if (jobLayers[utility][oldJobId].getLayers().length === 0) {
            delete jobLayers[utility][oldJobId];

            const oldBtn = document.querySelector(
              `[data-utility="${utility}"] .job-items button[data-job="${oldJobId}"]`
            );
            if (oldBtn) oldBtn.remove();
          }
        }

        // Create new group if it doesn't exist
        if (!jobLayers[utility][newJobId]) {
          jobLayers[utility][newJobId] = new L.FeatureGroup();
          layerConfig[utility].group.addLayer(jobLayers[utility][newJobId]);
        }

        updateJobList(utility);

        // Move layer to new group
        if (!jobLayers[utility][newJobId].hasLayer(layer)) {
          jobLayers[utility][newJobId].addLayer(layer);
        }

        p.jobId = newJobId;
      }

      // --- Update other properties ---
      p.description = popupEl.querySelector('#description').value;
      p.startDate = popupEl.querySelector('#startDate').value;
      p.endDate = popupEl.querySelector('#endDate').value;

      // --- Refresh popup ---
      layer.setPopupContent(renderView());
      layer.openPopup();

      // Optional: refresh job list UI
      updateJobList(p.utility); 
    };

    deleteBtn.onclick = () => {
      const utility = layer.feature.properties.utility;
      const jobId = layer.feature.properties.jobId;
      // Remove from drawnItems
      drawnItems.removeLayer(layer);
      // Remove from main group
      layerConfig[utility]?.group.removeLayer(layer);
      // Remove from sublayers
      if (layerConfig[utility]?.sublayers) {
        Object.values(layerConfig[utility].sublayers).forEach(sub => sub.removeLayer(layer));
      }
      // Remove from jobLayers
      if (jobId && jobLayers[utility]?.[jobId]) {
        jobLayers[utility][jobId].removeLayer(layer);
        if (jobLayers[utility][jobId].getLayers().length === 0) delete jobLayers[utility][jobId];
      }
      if (map.hasLayer(layer)) map.removeLayer(layer);
      updateJobList(utility);
    };
  };

  // Bind initial popup (view mode)
  layer.bindPopup(() => renderView());

  // Double-click to edit
  layer.on('dblclick', e => {
    e.originalEvent.preventDefault();
    openEdit();
  });
 
  return openEdit; // 
}



// =====================
// 8. Save all features
// =====================
document.getElementById('save-btn').addEventListener('click', () => {
  const allFeatures = [];

  function collectFeatures(group) {
    if (!group || !group.eachLayer) return;
    group.eachLayer(layer => {
      // If the layer is a FeatureGroup (sublayer), recurse
      if (layer instanceof L.FeatureGroup) {
        collectFeatures(layer);
      } else if (layer.feature) {
        // Update geometry before saving
        layer.feature.geometry = layer.toGeoJSON().geometry;
        allFeatures.push(layer.feature);
      }
    });
  }

  // Iterate all top-level utility groups
  Object.values(layerConfig).forEach(config => {
    collectFeatures(config.group);
  });

  if (!allFeatures.length) {
    alert("Nothing to save.");
    return;
  }

  const geojson = {
    type: 'FeatureCollection',
    features: allFeatures
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'utilities.geojson';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});


// =====================
// 8.5 Export excel
// =====================
function sanitizeExcel(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) {
    return "'" + value;   // Prefix with apostrophe
  }
  return value;
}

document.getElementById('export-excel-btn').addEventListener('click', () => {
  const allFeatures = [];
  const seenJobIds = new Set(); // prevent duplicates by JobID

  function collectFeatures(group, mainLayerName, subLayerName = '') {
    if (!group || !group.eachLayer) return;

    group.eachLayer(layer => {

      if (layer instanceof L.FeatureGroup) {
        collectFeatures(layer, mainLayerName, subLayerName);
        return;
      }

      if (!layer.feature?.properties) return;

      const p = layer.feature.properties;
      const jobId = p.jobId || '';

      // Skip if JobID already exported
      if (jobId && seenJobIds.has(jobId)) return;
      if (jobId) seenJobIds.add(jobId);

      allFeatures.push({
        JobID: sanitizeExcel(jobId),                     // FIRST COLUMN
        MainLayer: sanitizeExcel(mainLayerName || ''),
        SubLayer: sanitizeExcel(p.sublayer || subLayerName || ''),
        Utility: sanitizeExcel(p.utility || ''),
        Description: sanitizeExcel(p.description || ''),
        StartDate: sanitizeExcel(p.startDate || ''),
        EndDate: sanitizeExcel(p.endDate || ''),
        Length_m: sanitizeExcel(p.length_m || ''),
        Area_m2: sanitizeExcel(p.area_m2 || '')
      });
    });
  }

  Object.entries(layerConfig).forEach(([mainKey, config]) => {
    if (mainKey === 'stormwater') return;   //skip stormwater
    collectFeatures(config.group, mainKey);

    if (config.sublayers) {
      Object.entries(config.sublayers).forEach(([subKey, subGroup]) => {
        collectFeatures(subGroup, mainKey, subKey);
      });
    }
  });

  if (!allFeatures.length) {
    alert("No utility features to export!");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(allFeatures);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Utilities");
  XLSX.writeFile(wb, "utilities.xlsx");
});

// =====================
// 9. Load GeoJSON
// =====================
document.getElementById('load-btn').addEventListener('click', () => {
  document.getElementById('load-file').click();
});

document.getElementById('load-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".json") &&
      !file.name.toLowerCase().endsWith(".geojson")) {
    alert("Please upload a .json or .geojson file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = ev => {
    let geojson;
    try {
      geojson = JSON.parse(ev.target.result);
    } catch (err) {
      alert("File is not valid JSON.");
      return;
    }

    if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
      alert("File is not a valid GeoJSON FeatureCollection.");
      return;
    }
    
    geojson.features.forEach(feature => {
      const utility = feature.properties?.utility;
      const jobId = feature.properties?.jobId || `imported-${Date.now()}`;
      const sublayerName = feature.properties?.sublayer || '';

      if (!utility) return;

      // ✅ Ensure utility exists in layerConfig
      if (!layerConfig[utility]) {
        layerConfig[utility] = { group: L.featureGroup(), sublayers: {} };
      }

      // ✅ Ensure jobLayers container exists
      if (!jobLayers[utility]) {
        jobLayers[utility] = {};
      }

      // ✅ Ensure jobId group exists
      if (!jobLayers[utility][jobId]) {
        jobLayers[utility][jobId] = new L.FeatureGroup();
        layerConfig[utility].group.addLayer(jobLayers[utility][jobId]);
      }

      // Create GeoJSON normally
      const geoLayer = L.geoJSON(feature);

      geoLayer.eachLayer(layer => {
        layer._utility = utility;
        layer._currentJobId = jobId;
        layer._sublayer = sublayerName;

        // 1️⃣ Add to drawnItems (enables edit/delete)
        drawnItems.addLayer(layer);

        // 2️⃣ Ensure job storage exists
        if (!jobLayers[utility]) {
          jobLayers[utility] = {};
        }

        if (jobId) {

          if (!jobLayers[utility][jobId]) {
            jobLayers[utility][jobId] = new L.FeatureGroup();
            layerConfig[utility].group.addLayer(jobLayers[utility][jobId]);
          }

          jobLayers[utility][jobId].addLayer(layer);
        }

        // 5️⃣ Style
        applyUtilityStyle(layer, utility, sublayerName);

        // 6️⃣ Popup
        attachPopupHandlers(layer);
      });

    });

    updateJobList();
  };

  reader.readAsText(file);
});


function applyUtilityStyle(layer, utility, sublayerName) {
  if (!layer.setStyle) return;

  if (utility === 'roadworks' && sublayerName) {
    layer.setStyle({
      color: roadworksColors[sublayerName] || layerConfig[utility].color
    });
  } else if (utility === 'telecommunications' && sublayerName) {
    layer.setStyle({
      color: telecomColors[sublayerName] || layerConfig[utility].color
    });
  } else {
    layer.setStyle({
      color: layerConfig[utility].color
    });
  }
}


// =====================
// 10. Load SIX Maps–style cadastre
// =====================
function loadCadastre() {
  if (cadastreLoaded) {
    rebuildCadastreLayerIndex();
    return Promise.resolve();
  }

  if (cadastreLoadingPromise) return cadastreLoadingPromise;

  const canvasRenderer = L.canvas({ padding: 0.5 });

  cadastreLoadingPromise = fetch('https://soft-credit-c195.d-pipatvong.workers.dev/Cadastre.geojson')
    .then(r => r.json())
    .then(parcelGeojson => {

      cadastreLayers = [];
      // ---------- PARCELS ----------
      const parcels = L.geoJSON(parcelGeojson, {
        pane: 'cadastrePane',
        interactive: true,
        style: {
          color: 'oklch(70% 0.03 220)',
          weight: 0.8,
          fill: false
        },

        renderer: canvasRenderer,
        onEachFeature: (feature, layer) => {

          layer.on({
            mouseover: e => {
              const hoverColor = getComputedStyle(document.documentElement)
                                   .getPropertyValue('--accent-hover').trim();
              e.target.setStyle({ color: hoverColor, weight: 1.5 });
            },
            mouseout: e =>
              parcels.resetStyle(e.target)
          });

        const { LOT_NO, DP_NO, House_No } = feature.properties;

        const parts = [];

        if (House_No) parts.push(`No.${House_No}`);
        if (LOT_NO && DP_NO) parts.push(`Lot ${LOT_NO} DP ${DP_NO}`);

        if (parts.length) {
          layer.bindTooltip(parts.join('\n'), {
            permanent: false,
            direction: 'center',
            className: 'cadastre-label'
          });
        }

        layer.bindPopup(`
          <strong>Cadastre</strong><br>
          ${House_No ? `House No: ${escapeHTML(String(House_No))}<br>` : ''}
          ${LOT_NO ? `Lot: ${escapeHTML(String(LOT_NO))}<br>` : ''}
          ${DP_NO ? `DP: ${escapeHTML(String(DP_NO))}<br>` : ''}
          <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${layer.getBounds().getCenter().lat},${layer.getBounds().getCenter().lng}" target="_blank" rel="noopener">Open Street View</a>
        `);

      // ----- Right-click Street View -----
      layer.on('contextmenu', e => {
        const { lat, lng } = e.latlng;
        const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
        window.open(url, '_blank', 'noopener');
      });
        }
      });

      cadastreLayer.addLayer(parcels);

      // ---------- EASEMENTS ----------
      if (!easementsLoaded) {
        easementsLoaded = true;

        fetch('data/easements.geojson')
          .then(r => r.json())
          .then(easementGeojson => {

            const easements = L.geoJSON(easementGeojson, {
              style: {
                color: 'oklch(70% 0.22 38)',
                weight: 1.6,
                dashArray: '6,4',
                fill: false
              },
              renderer: canvasRenderer,
              onEachFeature: (feature, layer) => {
                if (feature.properties.TYPE) {
                  layer.bindTooltip(
                    `Easement: ${escapeHTML(feature.properties.TYPE)}`,
                    { sticky: true }
                  );
                }
              }
            });

            // SAME cadastre group
            cadastreLayer.addLayer(easements);
            rebuildCadastreLayerIndex();
          })
          .catch(err => console.error('Failed to load easements:', err));
      }

      cadastreLoaded = true;
      rebuildCadastreLayerIndex();
      // ---------- LABEL VISIBILITY ----------
      map.on('zoomend', () => {
        const zoom = map.getZoom();
        parcels.eachLayer(layer => {
          const tooltip = layer.getTooltip();
          if (!tooltip) return;
          const el = tooltip.getElement();
          if (el) el.style.display = zoom >= 18 ? 'block' : 'none';
        });
      });

      console.log('Cadastre (parcels + easements) loaded');
    })
    .catch(err => {
      cadastreLoaded = false;
      console.error(err);
    })
    .finally(() => {
      cadastreLoadingPromise = null;
    });

  return cadastreLoadingPromise;
}


//=======
//PANE TOGGLE
// =====================
// Move Layers Toggle into Leaflet Zoom Toolbar
// =====================

// Get your toggle button and layers pane
const layersPane = document.getElementById('layers-pane');
const toggleButton = document.getElementById('toggle-pane-btn');

// Initialize state: pane visible, icon as "X"
layersPane.classList.remove('hidden');
toggleButton.classList.add('active');

// Insert toggle button into Leaflet zoom container
const zoomContainer = map.zoomControl.getContainer();
zoomContainer.insertBefore(toggleButton, zoomContainer.firstChild);

// Toggle pane visibility when clicked
toggleButton.addEventListener('click', () => {
  layersPane.classList.toggle('hidden'); // show/hide pane
  toggleButton.classList.toggle('active'); // swap hamburger ↔ X
});

//========
// About
//========
document.addEventListener('DOMContentLoaded', function () {

  const modal = document.getElementById('about-modal');
  const card = modal.querySelector('.about-card');
  const closeBtn = document.getElementById('about-close');

  function openModal() {
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  // Sidebar About button
  const aboutBtn = document.getElementById('about-btn');
  aboutBtn.addEventListener('click', openModal);

  // ---- Close with X ----
  closeBtn.addEventListener('click', closeModal);

  // ---- Close when clicking outside card ----
  modal.addEventListener('click', function (e) {
    if (!card.contains(e.target)) {
      closeModal();
    }
  });

  // ---- Close with ESC ----
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // ---- Insert Leaflet version ----
  document.getElementById('leaflet-version').textContent = L.version;

});
