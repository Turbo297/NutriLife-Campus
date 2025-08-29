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
  <section class="mx-auto" style="max-width: 1024px;">
    <h1 class="h3 mb-3">Log in</h1>
    <form @submit.prevent="onSubmit" class="vstack gap-3">
      <div>
        <label class="form-label">Name</label>
        <input v-model.trim="form.email" class="form-control" required minlength="2"></input>
      </div>
      <div>
        <label class="form-label">Password</label>
        <input v-model.trim="form.password" type="email" class="form-control" required></input>
      </div>
      <button class="btn btn-primary w-100">Continue</button>
    </form>
  </section>
</template>