<template>
  <div class="d-flex flex-column min-vh-100">
    <!-- top -->
    <nav class="navbar navbar-expand-lg navbar-light bg-light border-bottom">
      <div class="container">
        <a class="navbar-brand fw-semibold" href="#">
            NutriLife Campus
        </a>
        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNavbar"
          aria-controls="mainNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="mainNavbar">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item">
              <a class="nav-link active" aria-current="page" href="#">Home</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#">Learn</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#">Plan</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#">Map</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#">Events</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#">Accounts</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <!-- main -->
    <main class="flex-grow-1">
      <div class="container py-4">
        <slot />
      </div>
    </main>

    <!-- footer -->
    <footer class="mt-auto bg-light border-top">
      <div class="container py-3 text-muted small d-flex justify-content-between">
        <span>© {{ new Date().getFullYear() }} NutriLife Campus</span>
        <span>Healthy on a student budget</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
</script>

<style scoped>
</style>

