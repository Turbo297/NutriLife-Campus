<template>
  <div class="profile-container">
    <!-- Header -->
    <div class="text-center mb-5">
      <img
        class="profile-avatar"
        src="https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
        alt="User Avatar"
      />
      <h2 class="profile-name">{{ user?.displayName || 'Anonymous User' }}</h2>
      <p class="profile-email text-muted">{{ user?.email }}</p>
    </div>

    <!-- Account Card -->
    <div class="card shadow-sm mb-4">
      <div class="card-body">
        <h5 class="card-title mb-3">Account Information</h5>
        <div class="info-item">
          <i class="bi bi-person-fill"></i>
          <span><strong>Name:</strong> {{ user?.displayName || 'Anonymous User' }}</span>
        </div>
        <div class="info-item">
          <i class="bi bi-envelope-fill"></i>
          <span><strong>Email:</strong> {{ user?.email }}</span>
        </div>
      </div>
    </div>

    <!-- My Registered Events -->
    <div class="card shadow-sm">
      <div class="card-body">
        <h5 class="card-title mb-3">My Registered Events</h5>

        <div v-if="loading" class="text-muted">Loading...</div>
        <div v-else-if="rows.length === 0" class="text-muted">
          You have not registered for any events yet.
        </div>

        <ul v-else class="list-group list-group-flush">
          <li
            v-for="row in rowsSorted"
            :key="row.registrationId"
            class="list-group-item py-3"
          >
            <div class="event-item">
              <h6 class="fw-semibold mb-1">{{ row.event?.title || '(Untitled Event)' }}</h6>
              <div class="event-detail">
                <i class="bi bi-calendar-event"></i>
                <span>{{ fmtRange(row.event?.start, row.event?.end) }}</span>
              </div>
              <div class="event-detail">
                <i class="bi bi-geo-alt-fill"></i>
                <span>{{ row.event?.address || row.event?.location || 'Address not provided' }}</span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collectionGroup, query, where, onSnapshot, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const auth = getAuth()
const user = ref(auth.currentUser)
const rows = ref([])
const loading = ref(true)
let unsub = null

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

function startListen(uid) {
  const q = query(collectionGroup(db, 'registrations'), where('uid', '==', uid))
  unsub = onSnapshot(q, async (snap) => {
    const promises = snap.docs.map(async (regDoc) => {
      const reg = regDoc.data()
      const eventRef = regDoc.ref.parent.parent
      let event = null
      if (eventRef) {
        const eventSnap = await getDoc(eventRef)
        if (eventSnap.exists()) event = { id: eventSnap.id, ...eventSnap.data() }
      }
      return { registrationId: regDoc.id, ...reg, event }
    })
    rows.value = await Promise.all(promises)
    loading.value = false
  }, (err) => {
    console.error('registrations listen error:', err)
    loading.value = false
  })
}

const rowsSorted = computed(() =>
  [...rows.value].sort((a, b) => {
    const as = toDateSafe(a.event?.start)?.getTime() ?? 0
    const bs = toDateSafe(b.event?.start)?.getTime() ?? 0
    return as - bs
  })
)

function toDateSafe(v) {
  if (!v) return null
  return v?.toDate ? v.toDate() : new Date(v)
}

function fmtDate(v) {
  const d = toDateSafe(v)
  if (!d) return ''
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function fmtRange(start, end) {
  const ds = toDateSafe(start)
  const de = toDateSafe(end)
  if (!ds && !de) return ''
  if (ds && !de) return fmtDate(ds)
  if (!ds && de) return fmtDate(de)
  const sameDay = ds.toDateString() === de.toDateString()
  const optsDate = { timeZone: 'Australia/Melbourne', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
  const optsTime = { timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit' }
  if (sameDay) {
    const datePart = ds.toLocaleDateString('en-AU', optsDate)
    const startTime = ds.toLocaleTimeString('en-AU', optsTime)
    const endTime = de.toLocaleTimeString('en-AU', optsTime)
    return `${datePart}, ${startTime} – ${endTime}`
  } else {
    const s = ds.toLocaleString('en-AU', { ...optsDate, ...optsTime })
    const e = de.toLocaleString('en-AU', { ...optsDate, ...optsTime })
    return `${s} – ${e}`
  }
}
</script>

<style scoped>
.profile-container {
  max-width: 800px;
  margin: 3rem auto;
  padding: 0 1rem;
}

.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  background: #f8f9fa;
  box-shadow: 0 4px 8px rgba(0,0,0,0.05);
}

.profile-name {
  font-weight: 600;
  margin-top: 1rem;
  color: #1d1d1f;
}

.profile-email {
  font-size: 0.95rem;
  color: #6c757d;
}

.card {
  border: none;
  border-radius: 1rem;
  background-color: #fff;
}

.card-title {
  font-weight: 600;
  color: #1d1d1f;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
  color: #333;
}

.event-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.event-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6c757d;
  font-size: 0.9rem;
}

.list-group-item {
  border: none;
  border-bottom: 1px solid #f1f1f1;
  background-color: transparent;
}

.fw-semibold {
  font-weight: 600;
}

</style>
