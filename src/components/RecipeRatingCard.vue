<script setup>
import { computed } from 'vue'
import RatingStars from '@/components/RatingStars.vue'
import { useMenuRatings } from '@/composables/useMenuRatings'

const props = defineProps({
  recipe: { type: Object, required: true } // { id, name, protein, tags }
})

const { avg, ratingCount, userStars, hasRated, setRating, uid } = useMenuRatings(String(props.recipe.id))

const avgText = computed(() =>
  ratingCount.value > 0
    ? `${avg.value.toFixed(1)} / 5 (${ratingCount.value} votes)`
    : 'No ratings yet'
)

async function onRate(n) {
  try {
    if (hasRated.value) {
      alert('You have already rated this recipe')
      return
    }
    await setRating(n)
  } catch (e) {
    alert(e.message || 'Failed to submit rating')
  }
}
</script>

<template>
  <div class="card h-100 shadow-sm">
    <div class="card-body">
      <h5 class="card-title">{{ recipe.name }}</h5>
      <p class="card-text text-muted mb-1">
        Protein: <strong>{{ recipe.protein }}g</strong>
      </p>
      <p v-if="recipe.tags?.length" class="small text-secondary">
        Tags: {{ recipe.tags.join(", ") }}
      </p>

      <hr class="my-2" />

      <div class="d-flex align-items-center gap-2 mb-1">
        <strong>Average Rating:</strong><span>{{ avgText }}</span>
      </div>

      <div class="d-flex align-items-center gap-2">
        <span class="text-muted">Your Rating:</span>
        <RatingStars 
          :model-value="userStars" 
          :readonly="!uid || hasRated" 
          size="20px" 
          @change="onRate" 
        />
        <small v-if="hasRated" class="text-muted">
          Already rated
        </small>
        <small v-else-if="!uid" class="text-muted">
          Login to rate
        </small>
      </div>
    </div>
  </div>
</template>
