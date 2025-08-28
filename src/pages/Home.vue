<script setup>
import Homepage from '@/assets/Homepage.jpg'
</script>

<template>
  <div class="row align-items-center">
      <div class="image-container">
        <img src="@/assets/Homepage.jpg" alt="Homepage" class="img-fluid rounded shadow-sm" />
        <div class="text-overlay">Culturally friendly, budget‑smart meals for international students.</div>
      </div>
      <div class="col-lg-7">
        <h1 class="display-5 fw-bold mb-3">Eat well on $10/day</h1>
        <div class="d-flex gap-2">
          <a class="btn btn-primary btn-lg" href="#">Explore Recipes</a>
          <a class="btn btn-outline-secondary btn-lg" href="#">Start Meal Planner</a>
        </div>
      </div>
    </div>
</template>

<style scoped>
.image-container {
  position: relative;
  display: inline-block;
}

.image-container img {
  width: 100%;
  display: block;
}

.text-overlay {
  position: absolute;
  bottom: 35px;
  left: 20px;
  color: white;
  font-size: 36px;
  font-weight: bold;
  border-radius: 5px;
  max-width: 40%;
}

header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
