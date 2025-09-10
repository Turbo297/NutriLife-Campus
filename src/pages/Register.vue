<template>
  <div class="container mt-5">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <h2 class="text-center mb-4">Create Account</h2>

        <div v-if="errors.authentication" class="alert alert-danger">
          {{ errors.authentication }}
        </div>

        <form @submit.prevent="submitForm">
          <!-- Username -->
          <div class="mb-3">
            <label for="username" class="form-label">Username</label>
            <input
              type="text"
              class="form-control"
              :class="{'is-invalid': errors.username}"
              id="username"
              v-model="formData.username"
              @blur="() => validateName(true)"
              @input="() => validateName(false)"
            />
            <div class="invalid-feedback">{{ errors.username }}</div>
          </div>

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
            />
            <div class="invalid-feedback">{{ errors.email }}</div>
          </div>

          <!-- Password -->
          <div class="mb-3">
            <label for="password" class="form-label">Password</label>
            <input
              type="password"
              class="form-control"
              :class="{'is-invalid': errors.password}"
              id="password"
              v-model="formData.password"
              @blur="() => validatePassword(true)"
              @input="() => validatePassword(false)"
            />
            <div class="invalid-feedback">{{ errors.password }}</div>
          </div>

          <!-- Confirm Password -->
          <div class="mb-4">
            <label for="confirmPassword" class="form-label">Confirm Password</label>
            <input
              type="password"
              class="form-control"
              :class="{'is-invalid': errors.confirmPassword}"
              id="confirmPassword"
              v-model="formData.confirmPassword"
              @blur="() => validateConfirmPassword(true)"
              @input="() => validateConfirmPassword(false)"
            />
            <div class="invalid-feedback">{{ errors.confirmPassword }}</div>
          </div>

          <div class="d-grid gap-2">
            <button 
              type="submit" 
              class="btn btn-primary"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Creating Account...' : 'Create Account' }}
            </button>
          </div>
        </form>

        <p class="text-center mt-3">
          Already have an account? 
          <router-link to="/login">Log in</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const auth = getAuth()
const isSubmitting = ref(false)

const formData = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const errors = ref({
  username: null,
  email: null,
  password: null,
  confirmPassword: null,
  authentication: null
})

const validateName = (blur) => {
  const name = formData.value.username.trim()
  if (!name) {
    if (blur) errors.value.username = 'Username is required'
    return false
  }
  if (name.length < 3) {
    if (blur) errors.value.username = 'Username must be at least 3 characters'
    return false
  }
  errors.value.username = null
  return true
}

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
  if (!/[A-Z]/.test(password)) {
    if (blur) errors.value.password = 'Password must contain an uppercase letter'
    return false
  }
  if (!/[a-z]/.test(password)) {
    if (blur) errors.value.password = 'Password must contain a lowercase letter'
    return false
  }
  if (!/\d/.test(password)) {
    if (blur) errors.value.password = 'Password must contain a number'
    return false
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    if (blur) errors.value.password = 'Password must contain a special character'
    return false
  }
  errors.value.password = null
  return true
}

const validateConfirmPassword = (blur) => {
  const confirm = formData.value.confirmPassword
  if (!confirm) {
    if (blur) errors.value.confirmPassword = 'Please confirm your password'
    return false
  }
  if (confirm !== formData.value.password) {
    if (blur) errors.value.confirmPassword = 'Passwords do not match'
    return false
  }
  errors.value.confirmPassword = null
  return true
}

const submitForm = async () => {
  // Validate all fields
  const isValid = 
    validateName(true) && 
    validateEmail(true) && 
    validatePassword(true) && 
    validateConfirmPassword(true)

  if (!isValid) return

  isSubmitting.value = true
  errors.value.authentication = null

  try {
    // Create user with email and password
    const { user } = await createUserWithEmailAndPassword(
      auth,
      formData.value.email,
      formData.value.password
    )

    // Update profile with username
    await updateProfile(user, {
      displayName: formData.value.username
    })

    console.log('Registration successful:', user.email)
    clearForm()
    router.push({ name: 'login' })
  } catch (error) {
    console.error('Registration error:', error.code)
    errors.value.authentication = formatFirebaseError(error.code)
  } finally {
    isSubmitting.value = false
  }
}

const clearForm = () => {
  formData.value = {
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  }
  Object.keys(errors.value).forEach(key => {
    errors.value[key] = null
  })
}

const formatFirebaseError = (code) => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered'
    case 'auth/invalid-email':
      return 'Please enter a valid email address'
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled. Please contact support.'
    case 'auth/weak-password':
      return 'Please choose a stronger password'
    default:
      return 'Registration failed. Please try again.'
  }
}
</script>

<style scoped>
.container {
  max-width: 800px;
}

.btn-primary {
  background-color: #007bff;
  border-color: #007bff;
}

.btn-primary:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

.alert {
  margin-top: 20px;
}
</style>