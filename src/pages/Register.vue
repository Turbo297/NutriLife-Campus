<script setup>
import { reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { login } = useAuth()

const STORAGE_KEY = 'register-form'

// Single source of truth for the form
const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreed: false,
  showPassword: false,
  showConfirm: false,
})

// Field-level error bag
const errors = reactive({
  username: null,
  email: null,
  password: null,
  confirmPassword: null,
  agreed: null,
})

// ---------- Validation helpers ----------
const validateUsername = (blur = false) => {
  const v = form.username.trim()
  if (!v) return blur && (errors.username = 'Username is required')
  if (v.length < 3) return blur && (errors.username = 'Username must be at least 3 characters')
  errors.username = null
}

const validateEmail = (blur = false) => {
  const v = form.email.trim()
  if (!v) return blur && (errors.email = 'Email is required')
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  if (!emailOk) return blur && (errors.email = 'Invalid email format')
  errors.email = null
}

const validatePassword = (blur = false) => {
  const password = form.password
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

  if (password.length < minLength) {
    if (blur) errors.password = `Password must be at least ${minLength} characters long`
  } else if (!hasUpperCase) {
    if (blur) errors.password = 'Password must contain at least one uppercase letter'
  } else if (!hasLowerCase) {
    if (blur) errors.password = 'Password must contain at least one lowercase letter'
  } else if (!hasNumber) {
    if (blur) errors.password = 'Password must contain at least one number'
  } else if (!hasSpecialChar) {
    if (blur) errors.password = 'Password must contain at least one special character'
  } else {
    errors.password = null
  }
}

const validateConfirm = (blur = false) => {
  if (!form.confirmPassword) return blur && (errors.confirmPassword = 'Please confirm your password')
  if (form.confirmPassword !== form.password) {
    return blur && (errors.confirmPassword = 'Passwords do not match')
  }
  errors.confirmPassword = null
}

const validateAgreed = (blur = false) => {
  if (!form.agreed) return blur && (errors.agreed = 'You must agree to the terms')
  errors.agreed = null
}

// Run all validators (used on submit)
const validateAll = () => {
  validateUsername(true)
  validateEmail(true)
  validatePassword(true)
  validateConfirm(true)
  validateAgreed(true)
  return Object.values(errors).every((e) => !e)
}

// Live validity indicator without touching error messages
const isValid = computed(() => {
  // Lightweight checks for button enabling
  const usernameOk = form.username.trim().length >= 3
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const p = form.password
  const passOk =
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /\d/.test(p) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(p)
  const confirmOk = form.confirmPassword && form.confirmPassword === form.password
  const agreedOk = !!form.agreed
  return usernameOk && emailOk && passOk && confirmOk && agreedOk
})

// ---------- Persistence ----------
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && typeof saved === 'object') {
      Object.assign(form, {
        username: saved.username ?? '',
        email: saved.email ?? '',
        password: saved.password ?? '',
        confirmPassword: saved.confirmPassword ?? '',
        agreed: !!saved.agreed,
      })
    }
  } catch { /* ignore */ }
})

watch(
  () => ({ ...form }),
  (v) => {
    // Don't persist the show/hide toggles
    const { showPassword, showConfirm, ...toSave } = v
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  },
  { deep: true }
)

// ---------- Actions ----------
const clearForm = () => {
  form.username = ''
  form.email = ''
  form.password = ''
  form.confirmPassword = ''
  form.agreed = false
  errors.username = errors.email = errors.password = errors.confirmPassword = errors.agreed = null
  localStorage.removeItem(STORAGE_KEY)
}

const onSubmit = () => {
  if (!validateAll()) return
  // Minimal "register then login" simulation for your assignment
  login({ name: form.username.trim(), email: form.email.trim() })
  clearForm()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="container mt-5">
    <div class="row">
      <div class="col-md-10 offset-md-1 col-lg-8 offset-lg-2">
        <h1 class="h3 mb-3">Create your account</h1>

        <form @submit.prevent="onSubmit" class="vstack gap-3" novalidate>
          <!-- Username -->
          <div>
            <label for="username" class="form-label">Username</label>
            <input
              id="username"
              type="text"
              class="form-control"
              :class="{'is-invalid': !!errors.username}"
              v-model.trim="form.username"
              @blur="validateUsername(true)"
              @input="validateUsername(false)"
              aria-describedby="usernameHelp usernameError">
            <div id="usernameError" class="invalid-feedback d-block" v-if="errors.username">
              {{ errors.username }}
            </div>
          </div>

          <!-- Email -->
          <div>
            <label for="email" class="form-label">Email</label>
            <input
              id="email"
              type="email"
              class="form-control"
              :class="{'is-invalid': !!errors.email}"
              v-model.trim="form.email"
              @blur="validateEmail(true)"
              @input="validateEmail(false)"
              aria-describedby="emailError">
            <div id="emailError" class="invalid-feedback d-block" v-if="errors.email">
              {{ errors.email }}
            </div>
          </div>

          <!-- Password + Confirm -->
          <div class="row g-3">
            <div class="col-md-6">
              <label for="password" class="form-label">Password</label>
              <div class="input-group">
                <input
                  :type="form.showPassword ? 'text' : 'password'"
                  id="password"
                  class="form-control"
                  :class="{'is-invalid': !!errors.password}"
                  v-model="form.password"
                  @blur="validatePassword(true)"
                  @input="validatePassword(false)"
                  aria-describedby="passwordHelp passwordError">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="form.showPassword = !form.showPassword">
                  {{ form.showPassword ? 'Hide' : 'Show' }}
                </button>
              </div>
              <div class="text-danger" v-if="errors.password">
                {{ errors.password }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="confirm" class="form-label">Confirm password</label>
              <div class="input-group">
                <input
                  :type="form.showConfirm ? 'text' : 'password'"
                  id="confirm"
                  class="form-control"
                  :class="{'is-invalid': !!errors.confirmPassword}"
                  v-model="form.confirmPassword"
                  @blur="validateConfirm(true)"
                  @input="validateConfirm(false)"
                  aria-describedby="confirmError">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="form.showConfirm = !form.showConfirm">
                  {{ form.showConfirm ? 'Hide' : 'Show' }}
                </button>
              </div>
              <div id="confirmError" class="invalid-feedback d-block" v-if="errors.confirmPassword">
                {{ errors.confirmPassword }}
              </div>
            </div>
          </div>

          <!-- Agree -->
          <div class="form-check">
            <input
              id="agree"
              class="form-check-input"
              type="checkbox"
              v-model="form.agreed"
              @blur="validateAgreed(true)"
              @change="validateAgreed(false)">
            <label class="form-check-label" for="agree">I agree to the terms</label>
            <div class="text-danger small mt-1" v-if="errors.agreed">{{ errors.agreed }}</div>
          </div>

          <!-- Actions -->
          <div class="d-grid gap-2">
            <button class="btn btn-primary" :disabled="!isValid">Create account</button>
            <button type="button" class="btn btn-outline-secondary" @click="clearForm">Clear</button>
          </div>

          <div class="text-center">
            Already have an account?
            <router-link :to="{ name: 'login' }">Log in</router-link>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: tighten spacing on small screens */
@media (max-width: 576px) {
  .input-group > .btn { min-width: 4.5rem; }
}
</style>