<script setup>
import { reactive, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { login } = useAuth()

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirm: '',
  agreed: false,
  show: false,    
  showConfirm: false
})

const errors = computed(() => {
  const e = {}
  if (!form.name.trim()) e.name = 'Name is required'
  else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'

  if (!form.email.trim()) e.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Invalid email format'

  if (!form.password) e.password = 'Password is required'
  else if (form.password.length < 6) e.password = 'Password must be at least 6 characters'

  if (!form.confirm) e.confirm = 'Please confirm your password'
  else if (form.confirm !== form.password) e.confirm = 'Passwords do not match'

  if (!form.agreed) e.agreed = 'You must agree to the terms'
  return e
})

const isValid = computed(() => Object.keys(errors.value).length === 0)

function onSubmit() {
  if (!isValid.value) return
  login({ name: form.name.trim(), email: form.email.trim() })
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-7 col-lg-6">
      <h1 class="h3 mb-3">Create your account</h1>
      <form @submit.prevent="onSubmit" class="vstack gap-3">
        <!-- Name -->
        <div>
          <label class="form-label">Name</label>
          <input v-model.trim="form.name" class="form-control" :class="{'is-invalid': errors.name}">
          <div class="invalid-feedback" v-if="errors.name">{{ errors.name }}</div>
        </div>

        <!-- Email -->
        <div>
          <label class="form-label">Email</label>
          <input v-model.trim="form.email" type="email" class="form-control" :class="{'is-invalid': errors.email}">
          <div class="invalid-feedback" v-if="errors.email">{{ errors.email }}</div>
        </div>

        <!-- Password -->
        <div>
          <label class="form-label">Password</label>
          <div class="input-group">
            <input :type="form.show ? 'text' : 'password'" v-model="form.password"
                   class="form-control" :class="{'is-invalid': errors.password}">
            <button class="btn btn-outline-secondary" type="button" @click="form.show=!form.show">
              {{ form.show ? 'Hide' : 'Show' }}
            </button>
            <div class="invalid-feedback d-block" v-if="errors.password">{{ errors.password }}</div>
          </div>
          <div class="form-text">At least 6 characters.</div>
        </div>

        <!-- Confirm -->
        <div>
          <label class="form-label">Confirm password</label>
          <div class="input-group">
            <input :type="form.showConfirm ? 'text' : 'password'" v-model="form.confirm"
                   class="form-control" :class="{'is-invalid': errors.confirm}">
            <button class="btn btn-outline-secondary" type="button" @click="form.showConfirm=!form.showConfirm">
              {{ form.showConfirm ? 'Hide' : 'Show' }}
            </button>
            <div class="invalid-feedback d-block" v-if="errors.confirm">{{ errors.confirm }}</div>
          </div>
        </div>

        <!-- Agree -->
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="agree" v-model="form.agreed">
          <label class="form-check-label" for="agree">I agree to the terms</label>
          <div class="text-danger small mt-1" v-if="errors.agreed">{{ errors.agreed }}</div>
        </div>

        <button class="btn btn-primary w-100" :disabled="!isValid">Create account</button>
        <div class="text-center">
          Already have an account?
          <router-link :to="{name:'login'}">Log in</router-link>
        </div>
      </form>
    </div>
  </div>
</template>
