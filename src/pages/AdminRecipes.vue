<script setup>
/**
 * RecipeManagement.vue
 * - Left: DataTable (2/3)
 * - Right: Tag Pie + Rating Buckets Bar (1/3)
 * - Data: Firestore /recipes
 */

import { ref, computed, onMounted } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'

// PrimeVue
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Rating from 'primevue/rating'
import Chart from 'primevue/chart'

// Chart.js registration (remove if already done in main.js)
import {
  Chart as ChartJS,
  Title, Tooltip, Legend,
  BarElement, ArcElement,
  CategoryScale, LinearScale
} from 'chart.js'
ChartJS.register(Title, Tooltip, Legend, BarElement, ArcElement, CategoryScale, LinearScale)

// ---------------- State ----------------
const rows = ref([])
const loading = ref(true)
const error = ref('')

const filters = ref({
  name:    { value: null, matchMode: 'contains' },
  tagsText:{ value: null, matchMode: 'contains' },
  protein: { value: null, matchMode: 'gte' }
})

// Optional knobs
const includeUnratedInZeroBucket = true   // if false, unrated will be ignored in buckets
const minRatingsThreshold = 0             // set to >=5 if you want to exclude low-sample recipes

// ---------------- Firestore load ----------------
async function loadRecipes() {
  try {
    const snap = await getDocs(collection(db, 'recipes'))
    rows.value = snap.docs.map((doc, idx) => {
      const d = doc.data()
      const ratingCount = Number(d.ratingCount ?? 0)
      const ratingSum   = Number(d.ratingSum ?? 0)
      const ratingAvg   = ratingCount > 0 ? ratingSum / ratingCount : 0
      const tags = Array.isArray(d.tags) ? d.tags : []
      return {
        id: doc.id,
        name: d.name ?? `Recipe ${idx + 1}`,
        tags,
        tagsText: tags.join(', '),
        protein: Number(d.protein ?? 0),
        ratingCount,
        ratingAvg
      }
    })
  } catch (e) {
    error.value = e?.message || 'Failed to load recipes from Firestore.'
  } finally {
    loading.value = false
  }
}
onMounted(loadRecipes)

// ---------------- Charts ----------------

// 1) Tag distribution (pie)
const tagPie = computed(() => {
  const count = new Map()
  rows.value.forEach(r => r.tags.forEach(t => count.set(t, (count.get(t) || 0) + 1)))
  return {
    labels: [...count.keys()],
    datasets: [{ data: [...count.values()] }]
  }
})

// 2) Rating buckets (bar): 0–1, 1–2, 2–3, 3–4, 4–5
const ratingBucketsBar = computed(() => {
  const labels = ['0–1', '1–2', '2–3', '3–4', '4–5']
  const counts = [0, 0, 0, 0, 0]

  rows.value.forEach(r => {
    // skip unrated if needed
    if (!includeUnratedInZeroBucket && r.ratingCount === 0) return
    if (r.ratingCount < minRatingsThreshold) return

    const avg = Number(r.ratingAvg || 0)
    // bucket index: [0,1) -> 0, [1,2) -> 1, ... [4,5] -> 4
    let idx = Math.floor(avg)
    if (idx < 0) idx = 0
    if (idx > 4) idx = 4 // clamp 5.0 to last bucket
    counts[idx]++
  })

  return {
    labels,
    datasets: [
      { label: 'Recipes count', data: counts }
    ]
  }
})

const pieOptions = { plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false, responsive: true }
const barOptions = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Recipes' } } }
}
</script>

<template>
  <div class="container py-4">
    <h3 class="mb-3">Recipe Management</h3>

    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="loading" class="text-muted">Loading recipes...</div>

    <div v-else class="row g-4">
      <!-- Left: Table (2/3) -->
      <div class="col-12 col-lg-8">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h5 class="card-title mb-3">Recipes</h5>

            <DataTable
              :value="rows"
              paginator :rows="10"
              :filters="filters" filterDisplay="row"
              responsiveLayout="scroll" :sortMode="'multiple'"
              :rowHover="true" class="p-datatable-sm"
              :emptyMessage="'No recipes found.'"
            >
              <Column field="name" header="Name" sortable filter filterPlaceholder="Search name" />

              <Column field="tagsText" header="Tags" sortable filter filterPlaceholder="Search tags">
                <template #body="{ data }">
                  <div class="d-flex flex-wrap gap-1">
                    <span v-for="t in data.tags" :key="t" class="badge rounded-pill text-bg-light border">
                      {{ t }}
                    </span>
                  </div>
                </template>
              </Column>

              <Column field="protein" header="Protein (g)" sortable filter dataType="numeric"
                      filterPlaceholder="≥ grams">
                <template #body="{ data }">
                  <span class="fw-semibold">{{ data.protein }}</span>
                </template>
              </Column>

              <Column field="ratingAvg" header="Avg Rating" sortable>
                <template #body="{ data }">
                  <div class="d-flex align-items-center gap-2">
                    <Rating :modelValue="data.ratingAvg" readonly :cancel="false" />
                    <small class="text-muted">{{ data.ratingAvg.toFixed(1) }}</small>
                    <small class="text-muted">({{ data.ratingCount }})</small>
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </div>

      <!-- Right: Charts (1/3) -->
      <div class="col-12 col-lg-4">
        <div class="card shadow-sm mb-4">
          <div class="card-body">
            <h6 class="card-title mb-3">Tags Distribution</h6>
            <div style="height: 260px">
              <Chart type="pie" :data="tagPie" :options="pieOptions" />
            </div>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-body">
            <h6 class="card-title mb-3">Rating Distribution (0–5)</h6>
            <div style="height: 280px">
              <Chart type="bar" :data="ratingBucketsBar" :options="barOptions" />
            </div>
            <small class="text-muted">
              Unrated recipes are {{ includeUnratedInZeroBucket ? 'counted in 0–1' : 'excluded' }}.
              Min ratings threshold: {{ minRatingsThreshold }}.
            </small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-title { font-weight: 600; }
.p-datatable .p-datatable-thead > tr > th { white-space: nowrap; }
</style>
