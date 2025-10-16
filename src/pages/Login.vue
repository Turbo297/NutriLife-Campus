<template>
  <div class="container mt-5">
    <div class="row">
      <div class="col-md-6 offset-md-3">
        <h1 class="text-center mb-4">Log In</h1>

        <!-- Error Alert -->
        <div
          v-if="errors.authentication"
          class="alert alert-danger alert-dismissible fade show"
        >
          {{ formatAuthError(errors.authentication) }}
          <button
            type="button"
            class="btn-close"
            @click="errors.authentication = null"
          ></button>
        </div>

        <!-- Email/Password Form -->
        <form @submit.prevent="submitForm">
          <!-- Email -->
          <div class="mb-3">
            <label for="email" class="form-label">Email</label>
            <input
              type="email"
              class="form-control"
              :class="{'is-invalid': errors.email}"
              id="email"
              v-model="formData.email"
              @blur="() => validateEmail(true)"
              @input="() => validateEmail(false)"
              required
            />
            <div class="invalid-feedback">{{ errors.email }}</div>
          </div>

          <!-- Password -->
          <div class="mb-4">
            <label for="password" class="form-label">Password</label>
            <input
              type="password"
              class="form-control"
              :class="{'is-invalid': errors.password}"
              id="password"
              v-model="formData.password"
              @blur="() => validatePassword(true)"
              @input="() => validatePassword(false)"
              required
            />
            <div class="invalid-feedback">{{ errors.password }}</div>
          </div>

          <!-- Buttons -->
          <div class="d-grid gap-2">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Logging in...' : 'Log In' }}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              @click="clearForm"
              :disabled="isSubmitting"
            >
              Clear
            </button>
          </div>
        </form>

        <!-- Divider -->
        <div class="d-flex align-items-center my-3">
          <hr class="flex-grow-1" />
          <span class="px-3 text-muted">or</span>
          <hr class="flex-grow-1" />
        </div>

        <!-- Google Sign In -->
        <div class="d-grid gap-2">
          <button
            class="btn btn-outline-danger"
            @click="loginWithGoogle"
            :disabled="isSubmitting"
          >
            <i class="bi bi-google me-2"></i> Sign in with Google
          </button>
        </div>

        <!-- Register Link -->
        <p class="text-center mt-3">
          Don't have an account?
          <router-link to="/register">Register here</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'

const router = useRouter()
const auth = getAuth()
const isSubmitting = ref(false)

const formData = ref({ email: '', password: '' })
const errors = ref({ email: null, password: null, authentication: null })

// ---------- Validation ----------
const validateEmail = (blur) => {
  const email = formData.value.email.trim()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email) {
    if (blur) errors.value.email = 'Email is required'
    return false
  }
  if (!emailRegex.test(email)) {
    if (blur) errors.value.email = 'Please enter a valid email'
    return false
  }
  errors.value.email = null
  return true
}

const validatePassword = (blur) => {
  const password = formData.value.password
  if (!password) {
    if (blur) errors.value.password = 'Password is required'
    return false
  }
  if (password.length < 8) {
    if (blur) errors.value.password = 'Password must be at least 8 characters'
    return false
  }
  errors.value.password = null
  return true
}

// ---------- Email/Password Login ----------
const submitForm = async () => {
  validateEmail(true)
  validatePassword(true)
  if (errors.value.email || errors.value.password) return

  isSubmitting.value = true
  errors.value.authentication = null

  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      formData.value.email,
      formData.value.password
    )
    if (cred.user.email === 'admin@gmail.com') router.push({ name: 'admin' })
    else router.push({ name: 'home' })
  } catch (error) {
    console.error('Login error:', error.code)
    errors.value.authentication = error.code
  } finally {
    isSubmitting.value = false
    clearForm()
  }
}

// ---------- Google Login ----------
async function loginWithGoogle() {
  isSubmitting.value = true
  errors.value.authentication = null
  try {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    const email = result.user?.email || ''
    if (email === 'admin@gmail.com') router.push({ name: 'admin' })
    else router.push({ name: 'home' })
  } catch (error) {
    console.error('Google login error:', error.code)
    errors.value.authentication = error.code
  } finally {
    isSubmitting.value = false
  }
}

// ---------- Helpers ----------
const clearForm = () => {
  formData.value = { email: '', password: '' }
  errors.value = { email: null, password: null, authentication: null }
}

const formatAuthError = (code) => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email format'
    case 'auth/user-disabled':
      return 'This account has been disabled'
    case 'auth/user-not-found':
      return 'No account found with this email'
    case 'auth/wrong-password':
      return 'Invalid password'
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup closed'
    default:
      return 'Login failed. Please try again.'
  }
}
</script>

<style scoped>
.btn:disabled {
  cursor: not-allowed;
}
</style>
