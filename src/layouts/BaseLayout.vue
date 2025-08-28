<template>
  <div class="d-flex flex-column min-vh-100">
    <!-- top -->
    <nav class="navbar navbar-expand-lg navbar-light bg-light border-bottom">
      <div class="container">
        <RouterLink class="navbar-brand fw-semibold" to="/">NutriLife Campus</RouterLink>

        <button class="navbar-toggler" type="button"
                data-bs-toggle="collapse" data-bs-target="#mainNavbar"
                aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="mainNavbar">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item">
              <router-link to="/" class="nav-link" exact-active-class="active">Home</router-link>
            </li>
            <li class="nav-item">
              <router-link to="/learn" class="nav-link" exact-active-class="active">Learn</router-link>
            </li>
            <li class="nav-item">
              <router-link to="/plan" class="nav-link" exact-active-class="active">Plan</router-link>
            </li>
            <li class="nav-item">
              <router-link to="/map" class="nav-link" exact-active-class="active">Map</router-link>
            </li>
            <li class="nav-item">
              <router-link to="/events" class="nav-link" exact-active-class="active">Events</router-link>
            </li>
            <AccountMenu />
          </ul>
        </div>
      </div>
    </nav>

    <!-- main -->
    <main class="flex-grow-1">
      <div class="container py-4">
        <router-view></router-view>
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
import AccountMenu from '@/components/AccountMenu.vue';
</script>
