import { ref, computed, watch } from 'vue'

const userRef = ref(JSON.parse(localStorage.getItem('auth:user') || 'null'))

export function useAuth() {
  const user = userRef
  const isLoggedIn = computed(() => !!user.value)

  function login({ email, password},) {
    user.value = { email, password}
  }

  function logout() {
    user.value = null
  }

    // Persist user to localStorage
  watch(user, (val) => {
    if (val) localStorage.setItem('auth:user', JSON.stringify(val))
    else localStorage.removeItem('auth:user')
  }, { deep: true })

  return { user, isLoggedIn, login, logout }
}
