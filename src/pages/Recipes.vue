<script setup>
import { ref, computed, onMounted } from "vue"

const recipes = ref([])
const search = ref("")
const minProtein = ref(0)
const loading = ref(false)
const error = ref("")

//computed filtered recipes based on search and minProtein
const filtered = computed(() =>
  recipes.value.filter(r =>
    r.name.toLowerCase().includes(search.value.toLowerCase()) &&
    r.protein >= Number(minProtein.value || 0)
  )
)

// read recipes from local JSON file
async function loadRecipes() {
  try {
    loading.value = true
    const res = await fetch("src/assets/json/recipes.json")
    if (!res.ok) throw new Error("Failed to fetch recipes")
    recipes.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadRecipes)
</script>

<template>
  <div class="container my-4">
    <h2 class="mb-3">🍲 Recipe List</h2>

    <!-- filter -->
    <div class="row g-2 mb-3">
      <div class="col-sm-6">
        <input
          v-model="search"
          type="text"
          class="form-control"
          placeholder="Search recipes..."
        />
      </div>
      <div class="col-sm-6">
        <input
          v-model="minProtein"
          type="number"
          min="0"
          class="form-control"
          placeholder="Min protein (g)"
        />
      </div>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="text-muted">Loading recipes...</div>
    <div v-else-if="error" class="text-danger">{{ error }}</div>

    <!-- recipe list -->
    <div v-else class="row">
      <div
        v-for="r in filtered"
        :key="r.id"
        class="col-md-4 col-sm-6 mb-3"
      >
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <h5 class="card-title">{{ r.name }}</h5>
            <p class="card-text text-muted mb-1">
              Protein: <strong>{{ r.protein }}g</strong>
            </p>
            <p v-if="r.tags.length" class="small text-secondary">
              Tags: {{ r.tags.join(", ") }}
            </p>
          </div>
        </div>
      </div>
      <p v-if="!filtered.length" class="text-muted">No recipes found.</p>
    </div>
  </div>
</template>
