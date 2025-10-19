<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import mapboxgl from 'mapbox-gl'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import 'mapbox-gl/dist/mapbox-gl.css'
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// -------------------- State --------------------
const router = useRouter()
const mapEl = ref(null)
const map = ref(null)

// All map markers (array) + a fast lookup by placeId (Map)
const markers = ref([])
const markersById = ref(new Map()) // placeId -> mapboxgl.Marker

const places = ref([])                // Firestore /places
const events = ref([])                // Firestore /events
const eventByPlaceId = ref(new Map()) // Mapping: placeId -> events[]

const ui = reactive({
  nearMe: false,
  radiusKm: 3,
  type: { supermarket: true, 'cheap-food': true, event: true },
  loading: true,
  error: ''
})

const userPos = ref(null) // {lat, lng}

// -------------------- Utilities --------------------
function haversineKm(a, b) {
  const toRad = d => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function withinRadius(p) {
  if (!ui.nearMe || !userPos.value) return true
  const d = haversineKm({ lat: p?.coords?.lat, lng: p?.coords?.lng }, userPos.value)
  return d <= ui.radiusKm
}

function distanceLabel(p) {
  if (!userPos.value) return ''
  const d = haversineKm({ lat: p.coords.lat, lng: p.coords.lng }, userPos.value)
  return `${d.toFixed(1)} km`
}

// -------------------- Firestore --------------------
async function loadPlacesAndEvents() {
  ui.loading = true
  try {
    // Places
    const ps = await getDocs(collection(db, 'places'))
    places.value = ps.docs.map(d => ({ id: d.id, ...d.data() }))

    // Events
    const es = await getDocs(collection(db, 'events'))
    events.value = es.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => (e.status || 'open') === 'open')

    // Map events to placeId
    const mapE = new Map()
    events.value.forEach(e => {
      const pid = typeof e.placeId === 'string' ? e.placeId : e.placeId?.id
      if (!pid) return
      if (!mapE.has(pid)) mapE.set(pid, [])
      mapE.get(pid).push(e)
    })
    eventByPlaceId.value = mapE
  } catch (e) {
    ui.error = e.message || String(e)
  } finally {
    ui.loading = false
  }
}

// -------------------- Filters --------------------
const filtered = computed(() => {
  return places.value
    .filter(p => ui.type[p.type])
    .filter(withinRadius)
    .map(p => ({
      ...p,
      _distanceKm:
        userPos.value && p?.coords?.lat != null && p?.coords?.lng != null
          ? haversineKm({ lat: p.coords.lat, lng: p.coords.lng }, userPos.value)
          : null,
      _events: eventByPlaceId.value.get(p.id) || []
    }))
    .sort((a, b) => {
      if (ui.nearMe && a._distanceKm != null && b._distanceKm != null) {
        return a._distanceKm - b._distanceKm
      }
      return (b.ratingAvg || 0) - (a.ratingAvg || 0)
    })
})

// -------------------- Map --------------------
function initMap() {
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
  map.value = new mapboxgl.Map({
    container: mapEl.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [144.9631, -37.8136], // Melbourne
    zoom: 12,
    attributionControl: true
  })
  map.value.addControl(new mapboxgl.NavigationControl(), 'top-right')

  map.value.on('load', () => {
    if (ui.nearMe && userPos.value) drawRadiusCircle()
    renderMarkers()
  })
}

function clearMarkers() {
  // Remove markers from map and clear both structures
  markers.value.forEach(m => m.remove())
  markers.value = []
  markersById.value.clear()
}

function renderMarkers() {
  if (!map.value) return
  clearMarkers()

  filtered.value.forEach(p => {
    const el = document.createElement('div')
    el.className = `marker ${p.type}` // per-type color

    // Badge for event count
    if (eventByPlaceId.value.has(p.id)) {
      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = eventByPlaceId.value.get(p.id).length
      el.appendChild(badge)
    }

    const popupHtml = `
      <div class="popup" role="dialog" aria-label="${p.name}">
        <strong>${p.name}</strong><br/>
        <small>${p.type} · ${p.address ?? ''}</small><br/>
        ${userPos.value ? `<small>Distance: ${distanceLabel(p)}</small><br/>` : ''}
        <div class="actions">
          ${eventByPlaceId.value.has(p.id)
            ? `<button class="btn btn-sm" data-action="view-events" data-id="${p.id}" aria-label="View events at ${p.name}">View Events</button>`
            : ''
          }
          <button class="btn btn-sm" data-action="route" data-id="${p.id}" aria-label="Route to ${p.name}">Route</button>
        </div>
      </div>
    `

    const popup = new mapboxgl.Popup({ offset: 16 }).setHTML(popupHtml)
    popup.on('open', () => {
      const pop = popup.getElement()
      if (!pop) return
      pop.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action')
          const id = btn.getAttribute('data-id')
          const place = places.value.find(x => x.id === id)
          if (!action || !place) return
          if (action === 'route') startRouteTo(place.coords)
          if (action === 'view-events') goToPlaceEvents(id)
        }, { once: true })
      })
    })

    const m = new mapboxgl.Marker(el)
      .setLngLat([p.coords.lng, p.coords.lat])
      .setPopup(popup)
      .addTo(map.value)

    markers.value.push(m)
    markersById.value.set(p.id, m) // <-- keep a fast pointer from placeId to Marker
  })
}

// -------------------- Locate (NEW) --------------------
/**
 * Fly to the place and open its popup.
 * Accepts a placeId (string) or a place object with { id }.
 */
function locateTo(target) {
  const id = typeof target === 'string' ? target : target?.id
  const place = places.value.find(x => x.id === id)
  if (!place || !map.value) return

  const center = [place.coords.lng, place.coords.lat]
  map.value.flyTo({ center, zoom: Math.max(map.value.getZoom(), 15), essential: true })

  const marker = markersById.value.get(id)
  if (marker) {
    const openPopup = () => {
      const popup = marker.getPopup && marker.getPopup()
      if (popup && !popup.isOpen?.()) marker.togglePopup()
    }
    // Small delay to sync with flyTo animation
    setTimeout(openPopup, 350)
  }
}

// -------------------- Directions --------------------
function startRouteTo(dest) {
  if (!userPos.value) {
    ui.nearMe = true
    return
  }
  const s = `${userPos.value.lat},${userPos.value.lng}`
  const d = `${dest.lat},${dest.lng}`
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(s)}&destination=${encodeURIComponent(d)}&travelmode=walking`
  window.open(url, '_blank')
}

// -------------------- Location ring --------------------
function requestUserLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

function removeRadiusCircle() {
  if (!map.value) return
  const id = 'near-circle'
  if (map.value.getLayer(id)) map.value.removeLayer(id)
  if (map.value.getSource(id)) map.value.removeSource(id)
}

function drawRadiusCircle() {
  if (!map.value || !userPos.value) return
  const id = 'near-circle'
  removeRadiusCircle()

  const steps = 128
  const center = [userPos.value.lng, userPos.value.lat]
  const coords = []

  // Calculate pixels per meter at current zoom (approx)
  const centerPx = map.value.project(center)
  const metersPerDegLat = 111320
  const p2 = map.value.project([center[0], center[1] + 0.0001])
  const pxPerMeter = Math.abs(p2.y - centerPx.y) / (0.0001 * metersPerDegLat)

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    const dx = Math.cos(t) * ui.radiusKm * 1000 * pxPerMeter
    const dy = Math.sin(t) * ui.radiusKm * 1000 * pxPerMeter
    const pt = map.value.unproject({ x: centerPx.x + dx, y: centerPx.y + dy })
    coords.push([pt.lng, pt.lat])
  }

  const data = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }] }
  map.value.addSource(id, { type: 'geojson', data })
  map.value.addLayer({ id, type: 'fill', source: id, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.15 } })
}

// -------------------- Event linkage --------------------
function goToPlaceEvents(placeId) {
  router.push({ name: 'events', query: { placeId } })
}

// -------------------- Lifecycle --------------------
onMounted(async () => {
  initMap()
  await loadPlacesAndEvents()
  if (map.value?.loaded()) renderMarkers()
})

onBeforeUnmount(() => {
  clearMarkers()
  removeRadiusCircle()
  map.value?.remove()
  map.value = null
})

// Re-render markers when filters or radius change
watch([filtered, () => ui.radiusKm], () => {
  renderMarkers()
  if (ui.nearMe) drawRadiusCircle()
})

// Toggle Near Me ring + get current position
watch(() => ui.nearMe, async (val) => {
  if (!val) {
    userPos.value = null
    removeRadiusCircle()
    return
  }
  try {
    const pos = await requestUserLocation()
    userPos.value = pos
    if (map.value) {
      map.value.flyTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.value.getZoom(), 13) })
      drawRadiusCircle()
    }
  } catch {
    ui.nearMe = false
    alert('Unable to get location. Please allow location access.')
  }
})
</script>

<template>
  <div class="map-layout">
    <aside class="panel" aria-label="Nearby places panel">
      <h3 class="title" id="nearby-title">Nearby Places</h3>

      <!-- Near Me toggle -->
      <div class="section" aria-labelledby="near-me-toggle">
        <label id="near-me-toggle" class="switch">
          <input type="checkbox" v-model="ui.nearMe" aria-describedby="near-me-hint" />
          <span>Enable "Near me"</span>
        </label>
        <small id="near-me-hint">Filters results by your current location.</small>
        <div v-if="ui.nearMe" class="radius">
          <label for="radius">Radius: {{ ui.radiusKm }} km</label>
          <input id="radius" type="range" min="0.5" max="10" step="0.5" v-model.number="ui.radiusKm" />
        </div>
      </div>

      <!-- Type filters -->
      <div class="section" aria-label="Type filters">
        <div class="group" role="group" aria-label="Place types">
          <label><input type="checkbox" v-model="ui.type.supermarket"> Supermarket</label>
          <label><input type="checkbox" v-model="ui.type['cheap-food']"> Cheap Food</label>
          <label><input type="checkbox" v-model="ui.type.event"> Event Place</label>
        </div>
      </div>

      <!-- Place list -->
      <div class="section list" aria-live="polite">
        <div v-if="ui.loading">Loading...</div>
        <div v-else-if="filtered.length === 0">No results found</div>
        <ul v-else>
          <li
            v-for="p in filtered"
            :key="p.id"
            class="card"
            tabindex="0"
            aria-label="Place card"
            :data-place-id="p.id"
          >
            <div class="row1">
              <strong>{{ p.name }}</strong>
              <small>{{ p.type }}</small>
            </div>
            <small>{{ p.address }}</small>
            <div class="row2">
              <small v-if="p._distanceKm != null">Distance: {{ p._distanceKm.toFixed(1) }} km</small>
              <small>⭐ {{ (p.ratingAvg ?? 0).toFixed(1) }} ({{ p.ratingCount ?? 0 }})</small>
            </div>
            <div class="actions">
              <button class="btn" @click="goToPlaceEvents(p.id)" v-if="p._events.length">
                View Events ({{ p._events.length }})
              </button>
              <button class="btn" @click="locateTo(p.id)">Locate</button>
              <button class="btn" @click="startRouteTo(p.coords)">Route</button>
            </div>
          </li>
        </ul>
      </div>
    </aside>

    <main class="map-wrap">
      <div ref="mapEl" class="map"></div>
    </main>
  </div>
</template>

<style scoped>
.map-layout { display: flex; height: calc(100vh - 64px); }
.panel {
  width: 320px; padding: 12px; overflow: auto;
  border-right: 1px solid rgba(0,0,0,.08);
  background: #fff;
}
.map-wrap { flex: 1; }
.map { width: 100%; height: 100%; }

.title { margin: 4px 0 8px; }
.section { margin-bottom: 12px; }
.group { display: flex; gap: 12px; flex-wrap: wrap; }
.switch { display: flex; align-items: center; gap: 8px; }

.list ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.card { border: 1px solid rgba(0,0,0,.08); border-radius: 12px; padding: 10px; background: #fff; }
.row1 { display: flex; justify-content: space-between; }
.row2 { display: flex; justify-content: space-between; color: #667085; margin-top: 4px; }
.actions { display: flex; gap: 8px; margin-top: 8px; }
.btn { font-size: 12px; padding: 6px 10px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f8fafc; cursor: pointer; }
.btn:hover { background: #eef2ff; }

/* Marker base */
.marker {
  width: 16px; height: 16px; border-radius: 50%;
  background: #2563eb; position: relative; box-shadow: 0 0 0 2px #fff;
}
.marker .badge {
  position: absolute; top: -6px; right: -6px;
  font-size: 10px; line-height: 1;
  padding: 3px 5px; border-radius: 999px;
  background: #ef4444; color: #fff;
}

/* Per-type colors */
.marker.supermarket { background: #16a34a; }
.marker.cheap-food { background: #f59e0b; }
.marker.event { background: #2563eb; } 

.popup .actions { margin-top: 6px; display: flex; gap: 6px; }
.popup .btn { font-size: 12px; padding: 4px 8px; }

/* Mobile */
@media (max-width: 900px) {
  .panel { width: 100%; position: absolute; z-index: 1; background: rgba(255,255,255,.95); }
  .map-layout { position: relative; }
}
</style>
