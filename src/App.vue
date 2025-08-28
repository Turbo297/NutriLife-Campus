<script setup>
import BaseLayout from './layouts/BaseLayout.vue';
import Home from '@/pages/Home.vue'
</script>

<template>
  <BaseLayout>
      <Home />
  </BaseLayout>
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
