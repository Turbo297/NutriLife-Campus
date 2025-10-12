<script setup>
// --- Events Page (Vue 3 + Firebase v9) ---
// Features:
// - List upcoming published events
// - Search by keyword and filter by tags
// - Register with 1 click (writes status="pending")
// - Disable button + label if already registered
// - Shows remaining seats if `seatsLeft` exists on the event document

import { ref, computed, onMounted, watch } from 'vue'
import {
  collection, collectionGroup, query, where, orderBy,
  getDocs, doc, setDoc, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase' // your Firebase initialization

// --- UI state ---
const loading = ref(false)
const error = ref('')
const events = ref([])                 // all events fetched from Firestore
const search = ref('')                 // keyword search
const selectedTags = ref([])           // array of selected tag filters
const allTags = [
  'festival', 'cooking', 'lifestyle',
  'vegetarian', 'vegan-option', 'halal',
  'budget', 'allergy-friendly', 'traditional'
]

// Current user info (null when not signed in)
const auth = getAuth()
const user = ref(auth.currentUser)

// Map of eventId -> registration status ("pending" | "confirmed" | "waitlist")
const myRegs = ref({})

// --- Load events (published + upcoming) ---
async function loadEvents() {
  loading.value = true
  error.value = ''
  try {
    const now = Timestamp.fromDate(new Date())
    const qref = query(
      collection(db, 'events'),
      where('isPublished', '==', true),
      where('startAt', '>=', now),
      orderBy('startAt', 'asc')
    )
    const snap = await getDocs(qref)
    events.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    error.value = (e && e.message) || String(e)
  } finally {
    loading.value = false
  }
}

// --- Load my registrations using a collection group query ---
async function loadMyRegistrations() {
  if (!user.value) { myRegs.value = {}; return }
  const regs = {}
  // Query every registration doc across all events where uid == current user
  const qref = query(collectionGroup(db, 'registrations'), where('uid', '==', user.value.uid))
  const snap = await getDocs(qref)
  snap.forEach(d => {
    // d.ref.path example: events/{eventId}/registrations/{uid}
    const pathParts = d.ref.path.split('/')
    const eventId = pathParts[1] // index 1 = {eventId}
    regs[eventId] = d.data().status || 'pending'
  })
  myRegs.value = regs
}

// --- Combined initializers ---
onMounted(async () => {
  await loadEvents()
  await loadMyRegistrations()
})

// Keep user state in sync and reload registrations when auth changes
onAuthStateChanged(auth, async (u) => {
  user.value = u
  await loadMyRegistrations()
})

// --- Computed: keyword + tag filtering ---
const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return events.value.filter(e => {
    const hitKw = !kw ||
      e.title?.toLowerCase().includes(kw) ||
      e.description?.toLowerCase().includes(kw) ||
      e.location?.name?.toLowerCase().includes(kw)
    const hitTags = selectedTags.value.length === 0 ||
      (Array.isArray(e.tags) && selectedTags.value.every(t => e.tags.includes(t)))
    return hitKw && hitTags
  })
})

// --- Helpers ---
function fmtRange(ev) {
  // Safe formatting for Firestore Timestamp -> local string
  const start = ev.startAt?.toDate?.() || new Date(ev.startAt)
  const end = ev.endAt?.toDate?.() || new Date(ev.endAt)
  try {
    return `${start.toLocaleString()} – ${end.toLocaleTimeString()}`
  } catch {
    return ''
  }
}
function seatsText(ev) {
  if (typeof ev.seatsLeft === 'number') {
    return `${ev.seatsLeft} seats left`
  }
  if (typeof ev.capacity === 'number') {
    return `Capacity: ${ev.capacity}`
  }
  return ''
}
function isRegistered(eventId) {
  return !!myRegs.value[eventId]
}
function regBadge(status) {
  if (!status) return ''
  if (status === 'confirmed') return 'badge bg-success'
  if (status === 'waitlist')  return 'badge bg-warning text-dark'
  return 'badge bg-secondary'
}

// --- Register action ---
// Frontend writes a single registration doc with status="pending".
// Cloud Function will:
//   - atomically decide confirmed/waitlist,
//   - update status,
//   - send confirmation email (.ics attached).
async function registerFor(ev) {
  if (!user.value) {
    alert('Please log in first.')
    return
  }
  try {
    const regRef = doc(db, 'events', ev.id, 'registrations', user.value.uid)
    await setDoc(regRef, {
      uid: user.value.uid,
      name: user.value.displayName || 'Student',
      email: user.value.email,
      registeredAt: serverTimestamp(),
      status: 'pending'
    }, { merge: false }) // fail on duplicate per security rule (recommended)
    // Local optimistic state
    myRegs.value = { ...myRegs.value, [ev.id]: 'pending' }
    alert('Registered! A confirmation email will be sent shortly.')
  } catch (e) {
    // If doc already exists or rule blocks, show a friendly message
    const msg = (e && e.message) || String(e)
    if (msg.includes('PERMISSION_DENIED') || msg.toLowerCase().includes('already')) {
      alert('You have already registered for this event.')
    } else {
      alert('Registration failed. Please try again later.')
      console.error(e)
    }
  }
}
</script>

<template>
  <div class="container my-4">
    <h2 class="mb-3">🎉 Events</h2>

    <!-- Filters -->
    <div class="row g-2 mb-3">
      <div class="col-md-6">
        <input v-model="search" class="form-control" placeholder="Search by title, description, or location..." />
      </div>
      <div class="col-md-6">
        <div class="d-flex flex-wrap gap-2">
          <label v-for="t in allTags" :key="t" class="form-check-label">
            <input class="form-check-input me-1" type="checkbox" :value="t" v-model="selectedTags">
            {{ t }}
          </label>
        </div>
      </div>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="alert alert-info">Loading events...</div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Empty state -->
    <div v-if="!loading && filtered.length === 0" class="text-muted">
      No events found. Try adjusting your filters.
    </div>

    <!-- Cards -->
    <div class="row g-4">
      <div class="col-md-6 col-lg-4" v-for="ev in filtered" :key="ev.id">
        <div class="card h-100 shadow-sm">
          <img v-if="ev.imageUrl" :src="ev.imageUrl" class="card-img-top" alt="cover" style="object-fit:cover; max-height:180px;">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title mb-1 d-flex align-items-center gap-2">
              <span>{{ ev.title }}</span>
              <span v-if="isRegistered(ev.id)" :class="regBadge(myRegs[ev.id])">
                {{ myRegs[ev.id] }}
              </span>
            </h5>
            <p class="text-muted mb-1">{{ fmtRange(ev) }}</p>
            <p class="mb-1"><strong>Location:</strong> {{ ev.location?.name }}</p>
            <p class="mb-2">{{ ev.description }}</p>

            <div class="mb-2">
              <span v-for="t in ev.tags" :key="t" class="badge bg-success me-1">{{ t }}</span>
            </div>

            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted">{{ seatsText(ev) }}</small>
              <button
                class="btn btn-primary"
                :disabled="isRegistered(ev.id)"
                @click="registerFor(ev)"
              >
                {{ isRegistered(ev.id) ? 'Already registered' : 'Register' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Minimal spacing tweaks */
.card-title { line-height: 1.3; }
</style>
