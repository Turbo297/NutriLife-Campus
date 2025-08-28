<script setup>
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { user, isLoggedIn, logout } = useAuth()

const initials = computed(() => {
  if (!user.value?.name) return 'U'
  return user.value.name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase()
})

function goLogin() {
  router.push({ name: 'login' })
}
function goRegister() {
  router.push({ name: 'register' })
}
function goProfile() {
  router.push({ name: 'profile' })
}
function doLogout() {
  logout()
  // redirect to home page
  router.push({ name: 'home' })
}
</script>

<template>
  <li class="nav-item dropdown">
    <a class="nav-link dropdown-toggle d-flex align-items-center gap-2"
       href="#"
       id="accountDropdown"
       role="button"
       data-bs-toggle="dropdown"
       aria-expanded="false">
      <span class="rounded-circle bg-secondary text-white d-inline-flex align-items-center justify-content-center"
            style="width:28px;height:28px;font-size:12px;">
        {{ isLoggedIn ? initials : 'A' }}
      </span>
      <span>Account</span>
    </a>

    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="accountDropdown" style="min-width: 240px;">
      <!-- not logged in: show registeration -->
      <template v-if="!isLoggedIn">
        <li class="px-3 py-2 text-muted small">You are not signed in</li>
        <li><hr class="dropdown-divider"></li>
        <li><button class="dropdown-item" @click="goLogin">Log in</button></li>
        <li><button class="dropdown-item" @click="goRegister">Register</button></li>
      </template>

        <!-- logged in: show account message and log-out --> 
      <template v-else>
        <li class="px-3 py-2">
          <div class="fw-semibold">{{ user.name }}</div>
          <div class="text-muted small">{{ user.email }}</div>
        </li>
        <li><hr class="dropdown-divider"></li>
        <li><button class="dropdown-item" @click="goProfile">My profile</button></li>
        <li><button class="dropdown-item text-danger" @click="doLogout">Log out</button></li>
      </template>
    </ul>
  </li>
</template>
