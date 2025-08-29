<script setup>
import { reactive } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { login } = useAuth()

const form = reactive({
  email: '',
  password: ''
})

function onSubmit() {
  if (!form.email || !form.password) return
  login({ email: form.email, password: form.password })
  router.push({ name: 'Home' })
}
</script>

<template>
  <section class="row align-items-center">
    <h1 class="h3 mb-3">Log in</h1>
    <form @submit.prevent="onSubmit" class="vstack gap-3">
      <div>
        <label class="form-label">Email</label>
        <input v-model.trim="form.email" type="email" class="form-control" required minlength="2">
      </div>
      <div>
        <label class="form-label">Password</label>
        <input v-model.trim="form.password" type="password" class="form-control" required>
      </div>
      <button class="btn btn-primary w-100">Continue</button>
    </form>
  </section>
</template>
