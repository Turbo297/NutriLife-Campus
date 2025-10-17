<script setup>
import { ref, onMounted } from 'vue'


import recipesRaw from '@/assets/json/recipes.json'

const rows = ref([])
const loading = ref(true)
const error = ref('')

const filters = ref({
  name:    { value: null, matchMode: 'contains' },
  type:    { value: null, matchMode: 'contains' },
  protein: { value: null, matchMode: 'gte' }
})

function normalize(r, idx) {
  const ratingAvg = r.ratingAvg ?? r.rating ?? null
  const createdAt = r.createdAt
    ? new Date(r.createdAt)
    : new Date(Date.now() - idx * 86400000)
  return {
    id: r.id ?? String(idx + 1),
    name: r.name ?? r.title ?? 'Untitled',
    type: r.type ?? r.category ?? 'unknown',
    protein: Number(r.protein ?? 0),
    ratingAvg,
    createdAt
  }
}

onMounted(async () => {
  try {
    const arr = Array.isArray(recipesRaw) ? recipesRaw : (recipesRaw.data ?? [])
    rows.value = arr.map(normalize)
  } catch (e) {
    error.value = e?.message || 'Failed to load local recipes JSON.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container py-4">
    <h3 class="mb-3">Recipe Management</h3>

    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="mb-3">
      <div class="card mb-2" aria-hidden="true">
        <div class="card-body">
          <p class="placeholder-glow mb-2"><span class="placeholder col-3"></span></p>
          <p class="placeholder-glow mb-0"><span class="placeholder col-8"></span></p>
        </div>
      </div>
    </div>

    <DataTable
      v-else
      :value="rows"
      paginator :rows="10"
      :filters="filters" filterDisplay="row"
      responsiveLayout="scroll" :sortMode="'multiple'"
      :emptyMessage="'No recipes found.'"
      :rowHover="true"
    >
      <Column field="name" header="Name" sortable filter filterPlaceholder="Search name" />
      <Column field="type" header="Type" sortable filter filterPlaceholder="Search type" />
      <Column field="protein" header="Protein (g)" sortable filter dataType="numeric"
              filterPlaceholder="≥ grams" />
      <Column field="ratingAvg" header="Avg Rating" sortable />
      <Column field="createdAt" header="Created" sortable
              :body="r => (r.createdAt instanceof Date ? r.createdAt.toLocaleDateString() : '')" />

      <template #empty>
        <div class="text-center text-muted py-4">No recipes found.</div>
      </template>
    </DataTable>
  </div>
</template>
