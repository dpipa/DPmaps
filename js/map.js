// =====================
// 1. Create map
// =====================
const map = L.map('map').setView([-33.8705, 150.9570], 18);

map.createPane('contourPane');
map.createPane('cadastrePane');
map.createPane('stormwaterPane');

map.getPane('contourPane').style.zIndex = 400;
map.getPane('cadastrePane').style.zIndex = 410;
map.getPane('stormwaterPane').style.zIndex = 420;

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

// =====================
// Map attribution
// =====================

// OpenStreetMap
const osm = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">' +
      'OpenStreetMap contributors</a>'
  }
);

// Esri global satellite
const esriSatellite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/' +
  'World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution:
      'Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> | ' +
      'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  }
);


// NSW SixMaps imagery
const nswImagery = L.tileLayer(
  'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution:
      '© State of New South Wales (Spatial Services, a business unit of the Department of Customer Service NSW). ' +
      'For current information go to ' +
      '<a href="https://www.spatial.nsw.gov.au" target="_blank" rel="noopener">' +
      'spatial.nsw.gov.au</a>',
    maxZoom: 21
  }
);


// Create labels pane (must be AFTER map is created)
map.createPane('labelsPane');
map.getPane('labelsPane').style.zIndex = 650;
map.getPane('labelsPane').style.pointerEvents = 'none';

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
  nswImagery,
  esriRoadLabels
]);

const baseMaps = {
  "🗺️ Street Map (OSM)": osm,
  "🛰️ NSW Imagery": nswImagery,
  "🛰️ NSW Hybrid (Imagery + Labels)": nswHybrid,
  "🛰️ Satellite (Esri)": esriSatellite
};


L.control.layers(baseMaps, null, {
  position: 'topright',
  collapsed: true
}).addTo(map);

nswHybrid.addTo(map);

// Search Bar
const geocoder = L.Control.geocoder({
  position: 'topleft',
  placeholder: 'Search address or Job ID…',
  geocoder: L.Control.Geocoder.nominatim({
    geocodingQueryParams: {
      countrycodes: 'au',
      viewbox: '150.85,-33.95,151.05,-33.80', //Bounds to LGA
      bounded: 1
    }
  }),
  suggestMinLength: 3,
  suggestTimeout: 250,
  defaultMarkGeocode: false
}).addTo(map);

// Keep a reference to the search marker
let searchMarker = null;

// 🔎 When user starts searching
geocoder.on('startgeocode', function(e) {

  const query = e.input.trim().toLowerCase();
  let foundLayers = [];

  // Search Job IDs
  Object.keys(jobLayers).forEach(utility => {

    Object.keys(jobLayers[utility]).forEach(jobId => {

      if (jobId.toLowerCase().includes(query)) {

        const group = jobLayers[utility][jobId];

        if (!map.hasLayer(group)) {
          map.addLayer(group);
        }

        group.eachLayer(layer => {
          foundLayers.push(layer);

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

  // IMPORTANT:
  // We DO NOT prevent default.
  // This allows address search to still run.

});

geocoder.on('markgeocode', function(e) {
  const center = e.geocode.center;

  if (searchMarker) {
    map.removeLayer(searchMarker);
  }

  searchMarker = L.marker(center, { riseOnHover: true }).addTo(map);

  // Build full address
  const props = e.geocode.properties || {};
  const address = [
    props.house_number || '',
    props.road || '',
    props.suburb || props.city || '',
    props.state || '',
    props.postcode || ''
  ].filter(Boolean).join(', ');

  map.setView(center, 18);
});


// =====================
// 2. Load Fairfield LGA boundary
// =====================
fetch('data/fairfield_lga.geojson')
  .then(res => {
    if (!res.ok) throw new Error('GeoJSON not found');
    return res.json();
  })
  .then(geojson => {
    console.log('Boundary loaded');

    const boundary = L.geoJSON(geojson, {
      style: {
        color: 'red',
        weight: 3,
        fill: false
      }
    }).addTo(map);

    map.fitBounds(boundary.getBounds());
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
let easementsLoaded = false;

// =====================
// 3.1 DEM Contours Layer
// =====================
const demContoursLayer = new L.FeatureGroup();
let demContoursLoaded = false;

// =====================
// DEM Contours Setup
// =====================

let demContoursLoaded2m = false;
let demContoursLoaded1m = false;

// Function to load contour file
function loadContours(url, targetLayer, callback) {

  fetch(url)
    .then(res => res.json())
    .then(geojson => {

      const contours = L.geoJSON(geojson, {
        
        renderer: L.canvas({ padding: 0.5 }),

        style: function(feature) {

          const level = feature.properties.Level;

          // Default 1m
          let color = 'oklch(70% 0.15 240)';
          let weight = 1.5;
          let opacity = 0.6;

          // Every 2m stronger
          if (level % 2 === 0) {
            color = 'oklch(60% 0.18 240)';
            weight = 2;
            opacity = 0.8;
          }

          // Every 10m = index contour
          if (level % 10 === 0) {
            color = 'oklch(45% 0.15 240)';
            weight = 3;
            opacity = 0.95;
          }

          return { color, weight, opacity };
        },

        onEachFeature: function(feature, layer) {

          if (feature.properties && feature.properties.Level != null) {

            const level = feature.properties.Level;

            // Invisible click buffer (easy clicking)
            const clickBuffer = L.polyline(layer.getLatLngs(), {
              weight: 10,
              opacity: 0,
              interactive: true,
              pane: 'contourPane'
            }).addTo(targetLayer);

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
        }
      });

      targetLayer.addLayer(contours);

      if (callback) callback();

    })
    .catch(console.error);
}


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
map.getPane('drawPane').style.zIndex = 640;
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

    // Create shared canvas renderer
    const canvasRenderer = L.canvas({ padding: 0.5 });

    fetch('data/stormwater.geojson')
      .then(res => res.json())
      .then(geojson => {

        stormwaterGeoJsonLayer = L.geoJSON(geojson, {
          pane: 'stormwaterPane',
          renderer: canvasRenderer,   

          style: {
            color: layerConfig.stormwater.color,
            weight: 2,        
            opacity: 0.8
          },

          pointToLayer: (feature, latlng) =>
            L.circleMarker(latlng, {
              renderer: canvasRenderer,   // important for points
              radius: 15,                 // good mobile touch size
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

        stormwaterLayer.addLayer(stormwaterGeoJsonLayer);
        
        stormwaterLoaded = true;

        console.log("Stormwater loaded (Canvas)");
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

map.on('draw:deletestart', function () {
  const confirmed = confirm('Delete mode enabled. Click a shape to delete it.');
  if (!confirmed) {
    drawControl._toolbars.edit._modes.remove.handler.disable();
  }
});

// ---------------------
// Optional: Listen to delete events
map.on('draw:deleted', function (e) {

  const affectedUtilities = new Set();

  e.layers.eachLayer(layer => {

    const utility = layer.feature?.properties?.utility;
    const jobId   = layer.feature?.properties?.jobId;

    // 1. Remove from drawnItems (safety)
    drawnItems.removeLayer(layer);

    if (utility && layerConfig[utility]) {

      // 2. Remove from main utility group
      layerConfig[utility].group.removeLayer(layer);

      // 3. Remove from all sublayers
      if (layerConfig[utility].sublayers) {
        Object.values(layerConfig[utility].sublayers).forEach(sub => {
          sub.removeLayer(layer);
        });
      }
    }

    // 4. Remove from job group
    if (
      utility &&
      jobId &&
      jobLayers[utility] &&
      jobLayers[utility][jobId]
    ) {

      jobLayers[utility][jobId].removeLayer(layer);

      // If job group is now empty → delete it completely
      if (jobLayers[utility][jobId].getLayers().length === 0) {
        delete jobLayers[utility][jobId];
      }
    }

      // Remove job button from UI if job group deleted
      if (!jobLayers[utility]?.[jobId]) {

        const utilitySection = document.querySelector(
          `[data-utility="${utility}"]`
        );

        if (utilitySection) {
          const buttons = utilitySection.querySelectorAll('.job-items button');

          buttons.forEach(btn => {
            if (btn.textContent === jobId) {
              btn.remove();
            }
          });
        }
      }
    // 5. Fully detach from map
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }

  });

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

map.on('draw:drawstart', function () {

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
  if (liveMeasureTooltip) {
    map.removeLayer(liveMeasureTooltip);
    liveMeasureTooltip = null;
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
    const btn = document.createElement('button');
    btn.textContent = jobId;

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

    items.appendChild(btn);
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
          addSingleJobButton(utility, newJobId);
        }

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

  // Optional: basic file type check
  if (!file.name.toLowerCase().endsWith(".json") &&
      !file.name.toLowerCase().endsWith(".geojson")) {
    alert("Please upload a .json or .geojson file.");
    return;
  }
  
  const reader = new FileReader();

  reader.onload = ev => {

    // Validate JSON safely to prevent crash
    let geojson;

    try {
      geojson = JSON.parse(ev.target.result);
    } catch (err) {
      alert("File is not valid JSON.");
      return;
    }

    // Validate GeoJSON structure
    if (
      !geojson ||
      geojson.type !== "FeatureCollection" ||
      !Array.isArray(geojson.features)
    ) {
      alert("File is not a valid GeoJSON FeatureCollection.");
      return;
    }

    geojson.features.forEach(feature => {

      const utility = feature.properties?.utility;
      const jobId = feature.properties?.jobId;
      const sublayerName = feature.properties?.sublayer;

      if (!utility || !layerConfig[utility]) return;

      const config = layerConfig[utility];

      // Create Leaflet layer from feature
      const layer = L.geoJSON(feature).getLayers()[0];
      if (!layer) return;

      layer.feature = feature;

      // -------------------------
      // 1️⃣ Rebuild job group
      // -------------------------
      if (jobId) {
        if (!jobLayers[utility][jobId]) {
          jobLayers[utility][jobId] = new L.FeatureGroup();
          config.group.addLayer(jobLayers[utility][jobId]);
        }

        jobLayers[utility][jobId].addLayer(layer);
      }

      // -------------------------
      // 2️⃣ Add to correct sublayer
      // -------------------------
      if (config.sublayers && sublayerName && config.sublayers[sublayerName]) {
        config.sublayers[sublayerName].addLayer(layer);
      } else {
        config.group.addLayer(layer);
      }

      // -------------------------
      // 3️⃣ Apply correct styling
      // -------------------------
      applyUtilityStyle(layer, utility, sublayerName);

      // -------------------------
      // 4️⃣ Add to drawnItems
      // -------------------------
      drawnItems.addLayer(layer);

      // -------------------------
      // 5️⃣ Reattach popup handlers
      // -------------------------
      attachPopupHandlers(layer);

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
  }

  else if (utility === 'telecommunications' && sublayerName) {
    layer.setStyle({
      color: telecomColors[sublayerName] || layerConfig[utility].color
    });
  }

  else {
    layer.setStyle({
      color: layerConfig[utility].color
    });
  }

}


// =====================
// 10. Load SIX Maps–style cadastre
// =====================
function loadCadastre() {
  if (cadastreLoaded) return;

  const canvasRenderer = L.canvas({ padding: 0.5 });
      
  fetch('https://soft-credit-c195.d-pipatvong.workers.dev/Cadastre.geojson')
    .then(r => r.json())
    .then(parcelGeojson => {
  

      // ---------- PARCELS ----------
      const parcels = L.geoJSON(parcelGeojson, {
        pane: 'cadastrePane',
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
          })
          .catch(err => console.error('Failed to load easements:', err));
      }

      map.addLayer(cadastreLayer);

      cadastreLoaded = true;


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
    .catch(console.error);
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



