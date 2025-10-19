<script setup>
import { ref, computed, onMounted } from "vue"
import RecipeRatingCard from "@/components/RecipeRatingCard.vue"

// --- Firestore imports ---
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore'

const recipes = ref([])
const search = ref("")
const minProtein = ref(0)
const loading = ref(false)
const error = ref("")

const filtered = computed(() =>
  recipes.value.filter(r =>
    (r.name || '').toLowerCase().includes(search.value.toLowerCase()) &&
    Number(r.protein ?? 0) >= Number(minProtein.value || 0)
  )
)

// Load recipes from Firestore: /recipes/*
async function loadRecipes() {
  const db = getFirestore()
  loading.value = true
  error.value = ""

  try {
    // You can change the orderBy field if needed
    const q = query(collection(db, 'recipes'), orderBy('name'))
    const snap = await getDocs(q)

    recipes.value = snap.docs.map(d => {
      const data = d.data() || {}
      return {
        id: d.id,
        name: data.name ?? '',
        protein: Number(data.protein ?? 0),
        tags: Array.isArray(data.tags) ? data.tags : [],
        // If you store rating aggregates on the doc, use them; otherwise default to 0
        avgRating: typeof data.avgRating === 'number'
          ? data.avgRating
          : (data.ratingCount > 0 ? (data.ratingSum / data.ratingCount) : 0)
      }
    })
  } catch (e) {
    console.error(e)
    error.value = e.message || 'Failed to load recipes'
  } finally {
    loading.value = false
  }
}

onMounted(loadRecipes)
</script>

<template>
  <div class="container my-4">
    <h2 class="mb-3">🍲 Recipe List</h2>

    <!-- Filters -->
    <div class="row g-2 mb-3">
      <div class="col-sm-6">
        <input v-model="search" type="text" class="form-control" placeholder="Search recipes..." />
      </div>
      <div class="col-sm-6">
        <input v-model.number="minProtein" type="number" min="0" class="form-control" placeholder="Min protein (g)" />
      </div>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="text-muted">Loading recipes...</div>
    <div v-else-if="error" class="text-danger">{{ error }}</div>

    <!-- List -->
    <div v-else class="row">
      <div v-for="r in filtered" :key="r.id" class="col-md-4 col-sm-6 mb-3">
        <RecipeRatingCard :recipe="r" />
      </div>
      <p v-if="!filtered.length" class="text-muted">No recipes found.</p>
    </div>
  </div>
</template>
