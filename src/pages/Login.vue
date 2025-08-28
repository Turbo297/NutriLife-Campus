<script setup>
import { reactive } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { login } = useAuth()
const form = reactive({ email: '', name: '' })

function onSubmit() {
  if (!form.email || !form.name) return
  login({ email: form.email, name: form.name })
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="h3 mb-3">Log in</h1>
      <form @submit.prevent="onSubmit" class="vstack gap-3">
        <div>
          <label class="form-label">Email</label>
          <input v-model.trim="form.email" type="email" class="form-control" required>
        </div>
        <div>
          <label class="form-label">Password</label>
          <input v-model.trim="form.name" class="form-control" required minlength="2">
        </div>
        <button class="btn btn-primary w-100">Continue</button>
      </form>
    </div>
  </div>
</template>
