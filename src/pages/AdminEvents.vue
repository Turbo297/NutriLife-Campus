<script setup>
// ----------------------------
// Imports
// ----------------------------
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
// UI state for sending
const sendingId = ref('') 
const toast = (msg) => alert(msg) 
async function sendReminderEmail(eventRow) {
  try {
    const functions = getFunctions(undefined, 'australia-southeast1')
    const sendEventReminder = httpsCallable(functions, 'sendEventReminder')

    sendingId.value = eventRow.id
    const payload = { eventId: eventRow.id } 
    const res = await sendEventReminder(payload)

    toast(`Reminder queued to ${res.data?.sent || 0} registrants.`)
  } catch (e) {
    console.error(e)
    toast(e?.message || 'Failed to send reminder.')
  } finally {
    sendingId.value = ''
  }
}
// ----------------------------
// Reactive State
// ----------------------------
const rows = ref([])          // Event list from Firestore
const loading = ref(true)     // Loading indicator
const error = ref('')         // Error message
let unsub = null              // Firestore unsubscribe handle

// PrimeVue DataTable filters (per-column)
const filters = ref({
  title:    { value: null, matchMode: 'contains' },
  category: { value: null, matchMode: 'contains' }
})

// ----------------------------
// Date/Time Helper Functions
// ----------------------------

// Convert Firestore Timestamp or other formats into a JS Date
function toDateAny(v) {
  if (!v) return null
  try {
    if (typeof v?.toDate === 'function') return v.toDate() // Firestore Timestamp object
    if (typeof v?.seconds === 'number') return new Timestamp(v.seconds, v.nanoseconds || 0).toDate()
    const d = new Date(v)
    return isNaN(d) ? null : d
  } catch {
    return null
  }
}

// Format the date in Australian (Melbourne) timezone
function fmtDateTime(v) {
  const d = toDateAny(v)
  return d
    ? d.toLocaleString('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Australia/Melbourne'
      })
    : ''
}

// ----------------------------
// Firestore Real-time Listener
// ----------------------------
onMounted(() => {
  try {
    const q = query(collection(db, 'events'), orderBy('startAt', 'desc'))
    unsub = onSnapshot(
      q,
      (snap) => {
        rows.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        loading.value = false
      },
      (e) => {
        error.value = e?.message || 'Failed to load events.'
        loading.value = false
      }
    )
  } catch (e) {
    error.value = e?.message || 'Failed to subscribe events.'
    loading.value = false
  }
})

// Unsubscribe when leaving the page
onBeforeUnmount(() => unsub && unsub())
</script>

<template>
  <div class="container py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="m-0">Event Management</h3>
      <router-link class="btn btn-primary" to="/admin/events/new">＋ New Event</router-link>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="mb-3">
      <div class="card mb-2" aria-hidden="true">
        <div class="card-body">
          <p class="placeholder-glow mb-2">
            <span class="placeholder col-3"></span>
          </p>
          <p class="placeholder-glow mb-0">
            <span class="placeholder col-8"></span>
          </p>
        </div>
      </div>
      <div class="card mb-2" aria-hidden="true">
        <div class="card-body">
          <p class="placeholder-glow mb-2">
            <span class="placeholder col-4"></span>
          </p>
          <p class="placeholder-glow mb-0">
            <span class="placeholder col-6"></span>
          </p>
        </div>
      </div>
    </div>

    <!-- Main Data Table -->
    <DataTable
      v-else
      :value="rows"
      paginator
      :rows="10"
      :filters="filters"
      filterDisplay="row"
      responsiveLayout="scroll"
      :sortMode="'multiple'"
      :emptyMessage="'No events found.'"
    >
      <!-- Title -->
      <Column field="title" header="Title" sortable filter filterPlaceholder="Search title" />

      <!-- Category (mapped from Firestore field 'category') -->
      <Column field="category" header="Category" sortable filter filterPlaceholder="Search category">
        <template #body="{ data }">
          {{ data.category || '-' }}
        </template>
      </Column>

      <!-- Start Time (Melbourne) -->
      <Column field="startAt" header="Start" sortable>
        <template #body="{ data }">
          {{ fmtDateTime(data.startAt) }}
        </template>
      </Column>

      <!-- End Time (Melbourne) -->
      <Column field="endAt" header="End" sortable>
        <template #body="{ data }">
          {{ fmtDateTime(data.endAt) }}
        </template>
      </Column>

      <!-- Capacity -->
      <Column field="capacity" header="Capacity" sortable />

      <!-- Seats Left (mapped from Firestore 'seatsLeft') -->
      <Column field="seatsLeft" header="Seats Left" sortable>
        <template #body="{ data }">
          {{ data.seatsLeft ?? '-' }}
        </template>
      </Column>
      <!-- Bulk Email -->
      <Column header="Email" :exportable="false">
        <template #body="{ data }">
          <button
            class="btn btn-outline-secondary btn-sm"
            :disabled="sendingId === data.id"
            @click="sendReminderEmail(data)"
            title="Send reminder to all registrants"
          >
            {{ sendingId === data.id ? 'Sending…' : 'Send Reminder' }}
          </button>
        </template>
      </Column>


      <!-- Removed: Status -->
      <!-- Removed: Actions -->

      <!-- Empty message -->
      <template #empty>
        <div class="text-center text-muted py-4">No events found.</div>
      </template>
    </DataTable>
  </div>
</template>
