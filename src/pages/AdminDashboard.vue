<script setup>
import { getAuth } from 'firebase/auth'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const auth = getAuth()
const router = useRouter()
const currentAdmin = ref(auth.currentUser?.email || 'Admin')

const adminRoutes = [
  {
    name: 'Recipe Management',
    description: 'View and manage all recipes',
    path: '/admin/recipes',
    icon: '🥗'
  },
  {
    name: 'User Management',
    description: 'Manage user accounts and permissions',
    path: '/admin/users',
    icon: '👥'
  },
  {
    name: 'Rating Overview',
    description: 'View all ratings and statistics',
    path: '/admin/ratings',
    icon: '⭐'
  }
]
</script>

<template>
  <div class="container py-4">
    <!-- Admin Header -->
    <div class="mb-4 pb-2 border-bottom">
      <h1 class="display-5">Admin Dashboard</h1>
      <p class="text-muted">Welcome back, {{ currentAdmin }}</p>
    </div>

    <!-- Admin Navigation Cards -->
    <div class="row g-4">
      <div v-for="route in adminRoutes" 
           :key="route.name" 
           class="col-md-4">
        <div class="card h-100 shadow-sm hover-card">
          <div class="card-body">
            <div class="display-6 mb-3">{{ route.icon }}</div>
            <h5 class="card-title">{{ route.name }}</h5>
            <p class="card-text text-muted">{{ route.description }}</p>
            <router-link 
              :to="route.path"
              class="btn btn-primary">
              Go to {{ route.name }}
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hover-card {
  transition: transform 0.2s;
}

.hover-card:hover {
  transform: translateY(-5px);
}
</style>