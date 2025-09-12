<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'

const router = useRouter()
const auth = getAuth()
const currentUser = ref(null)
const isLoggedIn = computed(() => !!currentUser.value)

const initials = computed(() => {
  if (!currentUser.value?.email) return 'A'
  return currentUser.value.email[0].toUpperCase()
})

const displayName = computed(() => {
  return currentUser.value?.displayName || 
         currentUser.value?.email?.split('@')[0] || 
         'User'
})

const isAdmin = computed(() => currentUser.value?.email === 'admin@gmail.com')

// Listen for auth state changes
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    currentUser.value = user
    console.log('Auth state changed:', user?.email)
  })
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

function goAdminDashboard() {
  router.push({ name: 'admin' })
}

async function doLogout() {
  try {
    await signOut(auth)
    console.log('Logged out successfully')
    router.push({ name: 'home' })
  } catch (error) {
    console.error('Logout error:', error)
  }
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
      <span>{{ isLoggedIn ? displayName : 'Account' }}</span>
    </a>

    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="accountDropdown" style="min-width: 240px;">
      <!-- not logged in: show registration -->
      <template v-if="!isLoggedIn">
        <li class="px-3 py-2 text-muted small">You are not signed in</li>
        <li><hr class="dropdown-divider"></li>
        <li><button class="dropdown-item" @click="goLogin">Log in</button></li>
        <li><button class="dropdown-item" @click="goRegister">Register</button></li>
      </template>

      <!-- logged in: show account info and logout -->
      <template v-else>
        <li class="px-3 py-2">
          <div class="fw-semibold">{{ displayName }}</div>
          <div class="text-muted small">{{ currentUser?.email }}</div>
        </li>
        <li><hr class="dropdown-divider"></li>
        <!-- Add Admin Dashboard button if user is admin -->
        <li v-if="isAdmin">
          <button class="dropdown-item text-primary" @click="goAdminDashboard">
            <i class="dropdown-item"></i>Admin Dashboard
          </button>
        </li>
        <li><button class="dropdown-item" @click="goProfile">My profile</button></li>
        <li><button class="dropdown-item text-danger" @click="doLogout">Log out</button></li>
      </template>
    </ul>
  </li>
</template>
