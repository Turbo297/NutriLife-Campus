<template>
  <div class="container mt-5" style="max-width: 800px">
    <h2 class="mb-4 text-center">User Profile</h2>

    <!-- Account -->
    <div class="card mb-4 shadow-sm">
      <div class="card-body">
        <h5 class="card-title">Account</h5>
        <p class="mb-1"><strong>Username</strong>: {{ user?.displayName || 'Anonymous User' }}</p>
        <p class="mb-0"><strong>Email</strong>: {{ user?.email }}</p>
      </div>
    </div>

    <!-- My Registrations -->
    <div class="card shadow-sm">
      <div class="card-body">
        <h5 class="card-title mb-3">My Registered Events</h5>

        <div v-if="loading" class="text-muted">Loading...</div>
        <div v-else-if="rows.length === 0" class="text-muted">
          You have not registered for any events yet.
        </div>

        <ul v-else class="list-group list-group-flush">
          <li v-for="row in rows" :key="row.registrationId" class="list-group-item">
            <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
              <div>
                <h6 class="mb-1">{{ row.event?.title || '(Untitled Event)' }}</h6>
                <div class="small text-muted">
                  <span v-if="row.event?.category"><strong>Category:</strong> {{ row.event.category }} · </span>
                  <span v-if="row.event?.location"><strong>Location:</strong> {{ row.event.location }} · </span>
                  <span><strong>When:</strong> {{ fmtDate(row.event?.start) }} – {{ fmtDate(row.event?.end) }}</span>
                </div>
                <div class="small mt-1">
                  <strong>Registered at:</strong> {{ fmtDate(row.registeredAt) }}
                </div>
              </div>
              <span class="badge text-bg-success align-self-center">{{ row.status || 'pending' }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>

  </div>
</template>

<script setup>
// --- Vue & Firebase ---
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import {
  collectionGroup, query, where, onSnapshot, getDoc
} from 'firebase/firestore'
import { db } from '@/firebase'

// --- State ---
const auth = getAuth()
const user = ref(auth.currentUser)
const rows = ref([])         // merged { registration fields + parent event fields }
const loading = ref(true)
let unsub = null

// --- Lifecycle: watch auth then load registrations ---
onMounted(() => {
  if (user.value) {
    startListen(user.value.uid)
  } else {
    onAuthStateChanged(auth, (u) => {
      user.value = u
      if (u) startListen(u.uid)
      else loading.value = false
    })
  }
})

onBeforeUnmount(() => {
  if (unsub) unsub()
})

// --- Listen registrations of current user via collectionGroup ---
function startListen(uid) {
  const q = query(collectionGroup(db, 'registrations'), where('uid', '==', uid))
  unsub = onSnapshot(q, async (snap) => {
    // Map each registration doc to a row with its parent event data
    const promises = snap.docs.map(async (regDoc) => {
      const reg = regDoc.data()
      // parent of 'registrations' is the event document
      const eventRef = regDoc.ref.parent.parent
      let event = null
      if (eventRef) {
        const eventSnap = await getDoc(eventRef)
        if (eventSnap.exists()) event = { id: eventSnap.id, ...eventSnap.data() }
      }
      return {
        registrationId: regDoc.id,
        // registration fields you stored under events/{eventId}/registrations/{regId}
        uid: reg.uid,
        email: reg.email,
        name: reg.name,
        status: reg.status,
        registeredAt: reg.registeredAt,
        // parent event fields
        event
      }
    })

    rows.value = await Promise.all(promises)
    loading.value = false
  }, (err) => {
    console.error('registrations listen error:', err)
    loading.value = false
  })
}

// --- Helpers ---
function fmtDate(v) {
  if (!v) return ''
  const d = v?.toDate ? v.toDate() : new Date(v)
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })
}
</script>

<style scoped>
.card { border-radius: 1rem; }
.list-group-item { border: none; border-bottom: 1px solid #f1f1f1; }
</style>
