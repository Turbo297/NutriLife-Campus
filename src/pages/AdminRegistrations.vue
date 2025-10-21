<script setup>
// AdminRegistrations (rewritten)
// - Live view of all event registrations (collectionGroup)
// - Melbourne time formatting
// - Modern toolbar with search, status chips, date range
// - Responsive table with row expansion
// - CSV export of filtered results

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { collectionGroup, query, orderBy, onSnapshot, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

// ---------------- State ----------------
const rows = ref([])
const loading = ref(true)
const error = ref('')

// UI state
const search = ref('')
const statusFilter = ref('all') // 'all' | 'pending' | 'confirmed' | 'cancelled'
const dateStart = ref('')       // yyyy-mm-dd
const dateEnd = ref('')         // yyyy-mm-dd
const rowsPerPage = ref(10)
const expanded = ref([])        // expanded row ids

// ---------------- Time utils ----------------
function fmtDateTime(date) {
  if (!(date instanceof Date)) return ''
  try {
    return date.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch {
    return ''
  }
}

function parseYMD(s) {
  // s: 'YYYY-MM-DD' -> Date at local midnight
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// ---------------- Event title cache ----------------
const eventTitleCache = new Map()
async function getEventTitleFromRegDoc(regDoc) {
  const eventRef = regDoc.ref.parent.parent
  if (!eventRef) return '(unknown event)'
  const key = eventRef.path
  if (eventTitleCache.has(key)) return eventTitleCache.get(key)
  const snap = await getDoc(eventRef)
  const t = snap.exists() ? (snap.data().title || '(untitled)') : '(deleted event)'
  eventTitleCache.set(key, t)
  return t
}

// ---------------- Live subscription ----------------
let unsub = null
onMounted(() => {
  try {
    const q = query(collectionGroup(db, 'registrations'), orderBy('registeredAt', 'desc'))
    unsub = onSnapshot(q, async (snap) => {
      loading.value = true

      const base = snap.docs.map(d => {
        const x = d.data()
        const appliedAt =
          x?.registeredAt && typeof x.registeredAt.toDate === 'function'
            ? x.registeredAt.toDate()
            : null

        return {
          id: d.id,
          userName: x.name ?? '',
          userEmail: x.email ?? '',
          status: x.status ?? '',
          appliedAt,                        // JS Date for display
          appliedAtMs: appliedAt?.getTime() ?? null, // numeric for sort
          _regDoc: d
        }
      })

      const withTitles = await Promise.all(
        base.map(async r => ({ ...r, eventTitle: await getEventTitleFromRegDoc(r._regDoc) }))
      )

      rows.value = withTitles
      loading.value = false
    }, (e) => {
      error.value = e?.message || 'Failed to load registrations.'
      loading.value = false
    })
  } catch (e) {
    error.value = e?.message || 'Failed to subscribe registrations.'
    loading.value = false
  }
})

onBeforeUnmount(() => { if (unsub) unsub() })

// ---------------- Derived ----------------
const stats = computed(() => {
  const all = rows.value.length
  const by = rows.value.reduce((acc, r) => {
    acc[r.status || 'unknown'] = (acc[r.status || 'unknown'] || 0) + 1
    return acc
  }, {})
  return {
    all,
    pending: by['pending'] || 0,
    confirmed: by['confirmed'] || 0,
    cancelled: by['cancelled'] || 0
  }
})

const filteredRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  const hasTerm = term.length > 0
  const sFilter = statusFilter.value
  const start = parseYMD(dateStart.value)
  const end = parseYMD(dateEnd.value)
  const startMs = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0).getTime() : -Infinity
  const endMs = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime() : Infinity

  return rows.value.filter(r => {
    if (sFilter !== 'all' && (r.status || '') !== sFilter) return false
    const t = r.appliedAtMs ?? 0
    if (!(startMs <= t && t <= endMs)) return false
    if (!hasTerm) return true
    const hay = `${r.eventTitle || ''} ${r.userName || ''} ${r.userEmail || ''}`.toLowerCase()
    return hay.includes(term)
  })
})

function clearFilters() {
  search.value = ''
  statusFilter.value = 'all'
  dateStart.value = ''
  dateEnd.value = ''
}

// ---------------- CSV export (filtered) ----------------
function exportCSV() {
  const data = filteredRows.value
  const header = ['Event', 'User', 'Email', 'Status', 'Applied At']
  const lines = data.map(r => [
    safe(r.eventTitle),
    safe(r.userName),
    safe(r.userEmail),
    safe(r.status),
    safe(fmtDateTime(r.appliedAt))
  ].join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `registrations_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)

  function safe(v) {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
}
</script>

<template>
  <div class="container py-4">
    <!-- Header / Actions -->
    <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
      <div class="me-2">
        <h3 class="m-0">Registrations</h3>
        <div class="text-muted small">Live registrations across all events</div>
      </div>
      <div class="d-flex gap-2 align-items-center">
        <select class="form-select form-select-sm w-auto" v-model.number="rowsPerPage">
          <option :value="10">10 / page</option>
          <option :value="25">25 / page</option>
          <option :value="50">50 / page</option>
        </select>
        <button class="btn btn-outline-primary" @click="exportCSV">Export CSV</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="row g-3 mb-3">
      <div class="col-6 col-md-3">
        <div class="card shadow-sm stat-card border-0">
          <div class="card-body py-3 d-flex justify-content-between align-items-center">
            <div>
              <div class="text-muted small">Total</div>
              <div class="h5 m-0">{{ stats.all }}</div>
            </div>
            <span class="badge bg-secondary-soft">All</span>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card shadow-sm stat-card border-0">
          <div class="card-body py-3 d-flex justify-content-between align-items-center">
            <div>
              <div class="text-muted small">Pending</div>
              <div class="h5 m-0">{{ stats.pending }}</div>
            </div>
            <span class="badge bg-warning-subtle text-warning-emphasis">Pending</span>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card shadow-sm stat-card border-0">
          <div class="card-body py-3 d-flex justify-content-between align-items-center">
            <div>
              <div class="text-muted small">Confirmed</div>
              <div class="h5 m-0">{{ stats.confirmed }}</div>
            </div>
            <span class="badge bg-success-subtle text-success-emphasis">Confirmed</span>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card shadow-sm stat-card border-0">
          <div class="card-body py-3 d-flex justify-content-between align-items-center">
            <div>
              <div class="text-muted small">Cancelled</div>
              <div class="h5 m-0">{{ stats.cancelled }}</div>
            </div>
            <span class="badge bg-secondary">Cancelled</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-3 shadow-sm border-0">
      <div class="card-body d-flex flex-column gap-3">
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <div class="input-group search w-auto flex-grow-1" style="min-width: 240px;">
            <span class="input-group-text">🔎</span>
            <input type="search" v-model.trim="search" class="form-control" placeholder="Search event, user, email" />
          </div>

          <div class="d-flex flex-wrap gap-2 align-items-center">
            <button type="button" class="btn btn-sm"
                    :class="statusFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'"
                    @click="statusFilter = 'all'">All</button>
            <button type="button" class="btn btn-sm"
                    :class="statusFilter === 'pending' ? 'btn-warning' : 'btn-outline-warning'"
                    @click="statusFilter = 'pending'">Pending</button>
            <button type="button" class="btn btn-sm"
                    :class="statusFilter === 'confirmed' ? 'btn-success' : 'btn-outline-success'"
                    @click="statusFilter = 'confirmed'">Confirmed</button>
            <button type="button" class="btn btn-sm"
                    :class="statusFilter === 'cancelled' ? 'btn-secondary' : 'btn-outline-secondary'"
                    @click="statusFilter = 'cancelled'">Cancelled</button>
          </div>

          <div class="ms-auto d-flex flex-wrap gap-2 align-items-center">
            <label class="text-muted small me-1">From</label>
            <input type="date" class="form-control form-control-sm w-auto" v-model="dateStart" />
            <label class="text-muted small ms-2 me-1">To</label>
            <input type="date" class="form-control form-control-sm w-auto" v-model="dateEnd" />
            <button class="btn btn-sm btn-outline-secondary ms-2" @click="clearFilters">Clear</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="mb-3" aria-hidden="true">
      <div class="card mb-2 shadow-sm">
        <div class="card-body">
          <p class="placeholder-glow mb-2"><span class="placeholder col-4"></span></p>
          <p class="placeholder-glow mb-0"><span class="placeholder col-6"></span></p>
        </div>
      </div>
      <div class="card mb-2 shadow-sm">
        <div class="card-body">
          <p class="placeholder-glow mb-2"><span class="placeholder col-3"></span></p>
          <p class="placeholder-glow mb-0"><span class="placeholder col-5"></span></p>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div v-if="!loading" class="d-flex justify-content-between align-items-center mb-2">
      <div class="text-muted small">Showing {{ filteredRows.length }} / {{ rows.length }}</div>
    </div>
    <DataTable
      v-if="!loading"
      :value="filteredRows"
      dataKey="id"
      v-model:expandedRows="expanded"
      paginator
      :rows="rowsPerPage"
      :rowsPerPageOptions="[10, 25, 50]"
      responsiveLayout="scroll"
      :rowHover="true"
      :sortField="'appliedAtMs'"
      :sortOrder="-1"
      :emptyMessage="'No registrations match your filters.'"
    >
      <Column expander style="width: 3rem" />
      <Column field="eventTitle" header="Event" sortable />
      <Column field="userName" header="User" sortable />
      <Column field="userEmail" header="Email" sortable />
      <Column field="status" header="Status" sortable>
        <template #body="{ data }">
          <span class="badge text-capitalize"
                :class="{
                  'text-bg-warning': data.status === 'pending',
                  'text-bg-success': data.status === 'confirmed',
                  'text-bg-secondary': data.status === 'cancelled'
                }">
            {{ data.status || '-' }}
          </span>
        </template>
      </Column>
      <Column field="appliedAt" :sortField="'appliedAtMs'" header="Applied At" sortable>
        <template #body="{ data }">{{ fmtDateTime(data.appliedAt) }}</template>
      </Column>

      <!-- Row expansion: quick details -->
      <template #expansion="{ data }">
        <div class="p-3 bg-light rounded border small">
          <div class="row g-2">
            <div class="col-12 col-md-6">
              <div class="text-muted">Event</div>
              <div class="fw-semibold">{{ data.eventTitle }}</div>
            </div>
            <div class="col-12 col-md-3">
              <div class="text-muted">User</div>
              <div>{{ data.userName }}</div>
            </div>
            <div class="col-12 col-md-3">
              <div class="text-muted">Email</div>
              <div>{{ data.userEmail }}</div>
            </div>
            <div class="col-12 col-md-3">
              <div class="text-muted">Status</div>
              <div>
                <span class="badge text-capitalize"
                      :class="{
                        'text-bg-warning': data.status === 'pending',
                        'text-bg-success': data.status === 'confirmed',
                        'text-bg-secondary': data.status === 'cancelled'
                      }">{{ data.status || '-' }}</span>
              </div>
            </div>
            <div class="col-12 col-md-3">
              <div class="text-muted">Applied</div>
              <div>{{ fmtDateTime(data.appliedAt) }}</div>
            </div>
          </div>
        </div>
      </template>

      <template #empty>
        <div class="text-center text-muted py-4">No registrations found.</div>
      </template>
    </DataTable>
  </div>
  
</template>

<style scoped>
.stat-card { border-radius: 0.75rem; }
.bg-secondary-soft { background: rgba(108,117,125,.15); color: #6c757d; }
.text-capitalize { text-transform: capitalize; }

/* Make search input group compact on small screens */
@media (max-width: 576px) {
  .search .input-group-text { display: none; }
}
</style>
