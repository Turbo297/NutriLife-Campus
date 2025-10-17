<script setup>
/**
 * AdminRegistrations.vue
 * - Reads all events registrations via collectionGroup('registrations')
 * - Formats times in Australia/Melbourne
 * - No inline actions; supports sort/filter/pagination + CSV export
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { collectionGroup, query, orderBy, onSnapshot, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dropdown from 'primevue/dropdown'

// ---------------- State ----------------
const rows = ref([])
const loading = ref(true)
const error = ref('')

const filters = ref({
  eventTitle: { value: null, matchMode: 'contains' },
  userName:   { value: null, matchMode: 'contains' },
  status:     { value: null, matchMode: 'equals' }
})

// ---------------- Time utils ----------------
function fmtDateTime(date) {
  if (!(date instanceof Date)) return ''
  return date.toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
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

// ---------------- CSV export ----------------
function exportCSV() {
  const header = ['Event', 'User', 'Email', 'Status', 'Applied At']
  const lines = rows.value.map(r => [
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
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="m-0">Registrations</h3>
      <button class="btn btn-outline-primary" @click="exportCSV">Export CSV</button>
    </div>

    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <div v-if="loading" class="mb-3">
      <div class="card mb-2" aria-hidden="true">
        <div class="card-body">
          <p class="placeholder-glow mb-2"><span class="placeholder col-4"></span></p>
          <p class="placeholder-glow mb-0"><span class="placeholder col-6"></span></p>
        </div>
      </div>
    </div>

    <DataTable
      v-else
      :value="rows"
      paginator :rows="10"
      :filters="filters" filterDisplay="row"
      responsiveLayout="scroll" :sortMode="'multiple'"
      :emptyMessage="'No registrations found.'"
      :rowHover="true"
    >
      <Column field="eventTitle" header="Event" sortable filter filterPlaceholder="Search event" />
      <Column field="userName" header="User" sortable filter filterPlaceholder="Search user" />
      <Column field="userEmail" header="Email" sortable />
      <Column field="status" header="Status" sortable filter :showFilterMenu="false">
        <template #filter>
          <Dropdown
            v-model="filters.status.value"
            :options="['pending', 'confirmed', 'rejected', 'cancelled']"
            placeholder="All"
            showClear
          />
        </template>
        <template #body="{ data }">
          <span
            class="badge"
            :class="{
              'text-bg-warning': data.status === 'pending',
              'text-bg-success': data.status === 'confirmed',
              'text-bg-secondary': data.status === 'rejected' || data.status === 'cancelled'
            }"
          >
            {{ data.status }}
          </span>
        </template>
      </Column>

      <!-- Melbourne time display; numeric field used for accurate sorting -->
      <Column
        field="appliedAt"
        :sortField="'appliedAtMs'"
        header="Applied At"
        sortable
        >
        <template #body="{ data }">
            {{ fmtDateTime(data.appliedAt) }}
        </template>
      </Column>

      <template #empty>
        <div class="text-center text-muted py-4">No registrations found.</div>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.badge { text-transform: capitalize; }
</style>
