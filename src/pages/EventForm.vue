<script setup>
// --------------------------------------
// Imports
// --------------------------------------
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  collection, addDoc, doc, getDoc, setDoc,
  Timestamp, serverTimestamp
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '@/firebase'

// --------------------------------------
// Router & Auth
// --------------------------------------
const route = useRoute()
const router = useRouter()
const auth = getAuth()
const eventId = computed(() => route.params.id) // undefined for "new"

// --------------------------------------
// Form model
// --------------------------------------
const form = ref({
  title: '',
  category: '',
  description: '',
  startAt: '',     // HTML datetime-local string: "YYYY-MM-DDTHH:mm"
  endAt: '',       // HTML datetime-local string
  capacity: 0,
  seatsLeft: null, // if null on submit -> default to capacity
  imageUrl: '',
  location: {
    name: '',
    address: '',
    lat: null,
    lng: null,
  },
  tags: [],        // array of strings
  // Note: isPublished / createdBy / createdAt / updatedAt are set automatically
})

const loading = ref(false)
const saving  = ref(false)
const error   = ref('')

// --------------------------------------
// Helpers
// --------------------------------------

// Convert HTML "datetime-local" value to Firestore Timestamp
function toTimestamp(dtLocalStr) {
  if (!dtLocalStr) return null
  const d = new Date(dtLocalStr.replace('T', 'T') + ':00') // seconds added for consistency
  return isNaN(d) ? null : Timestamp.fromDate(d)
}

// Convert Firestore Timestamp/millis to "datetime-local" string
function toLocalInputValue(v) {
  try {
    let d = null
    if (!v) return ''
    if (typeof v?.toDate === 'function') d = v.toDate()
    else if (typeof v?.seconds === 'number') d = new Timestamp(v.seconds, v.nanoseconds || 0).toDate()
    else d = new Date(v)
    if (!d || isNaN(d)) return ''
    const pad = (n) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm   = pad(d.getMonth() + 1)
    const dd   = pad(d.getDate())
    const hh   = pad(d.getHours())
    const mi   = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  } catch {
    return ''
  }
}

// Minimal client-side validation
function validate() {
  if (!form.value.title?.trim()) return 'Title is required.'
  if (!form.value.category?.trim()) return 'Category is required.'
  if (!form.value.startAt) return 'Start time is required.'
  if (!form.value.endAt) return 'End time is required.'
  if (new Date(form.value.endAt) < new Date(form.value.startAt)) return 'End must be after Start.'
  if (Number(form.value.capacity) <= 0) return 'Capacity must be greater than 0.'
  return ''
}

// --------------------------------------
// Load doc for edit mode
// --------------------------------------
onMounted(async () => {
  if (!eventId.value) return
  try {
    loading.value = true
    const snap = await getDoc(doc(db, 'events', eventId.value))
    if (!snap.exists()) {
      error.value = 'Event not found.'
      return
    }
    const data = snap.data()
    form.value = {
      title: data.title ?? '',
      category: data.category ?? '',
      description: data.description ?? '',
      startAt: toLocalInputValue(data.startAt),
      endAt: toLocalInputValue(data.endAt),
      capacity: data.capacity ?? 0,
      seatsLeft: data.seatsLeft ?? null,
      imageUrl: data.imageUrl ?? '',
      location: {
        name: data.location?.name ?? '',
        address: data.location?.address ?? '',
        lat: data.location?.lat ?? null,
        lng: data.location?.lng ?? null,
      },
      tags: Array.isArray(data.tags) ? data.tags : []
      // isPublished/createdBy/createdAt/updatedAt are not shown in form
    }
  } catch (e) {
    error.value = e?.message || 'Failed to load event.'
  } finally {
    loading.value = false
  }
})

// --------------------------------------
// Submit (create or update)
// --------------------------------------
async function onSubmit() {
  error.value = ''

  // Validate
  const msg = validate()
  if (msg) {
    error.value = msg
    return
  }

  // Build payload for Firestore
  const payload = {
    title: form.value.title.trim(),
    category: form.value.category.trim(),
    description: form.value.description?.trim() || '',
    startAt: toTimestamp(form.value.startAt),
    endAt: toTimestamp(form.value.endAt),
    capacity: Number(form.value.capacity) || 0,
    seatsLeft:
      form.value.seatsLeft == null || form.value.seatsLeft === ''
        ? Number(form.value.capacity) || 0
        : Number(form.value.seatsLeft),
    imageUrl: form.value.imageUrl?.trim() || '',
    location: {
      name: form.value.location?.name?.trim() || '',
      address: form.value.location?.address?.trim() || '',
      lat: form.value.location?.lat == null ? null : Number(form.value.location.lat),
      lng: form.value.location?.lng == null ? null : Number(form.value.location.lng),
    },
    tags: Array.isArray(form.value.tags)
      ? form.value.tags.map(t => String(t).trim()).filter(Boolean)
      : []
  }

  try {
    saving.value = true
    if (eventId.value) {
      // -------- Edit mode --------
      await setDoc(
        doc(db, 'events', eventId.value),
        {
          ...payload,
          updatedAt: serverTimestamp() // always update server time
        },
        { merge: true }
      )
    } else {
      // -------- Create mode --------
      const uid = auth.currentUser?.uid || 'anonymous'
      await addDoc(collection(db, 'events'), {
        ...payload,
        isPublished: true,          // default publish on create
        createdBy: uid,             // current user's UID
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    }
    router.push('/admin/events')
  } catch (e) {
    error.value = e?.message || 'Failed to save event.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="container py-4" style="max-width: 900px;">
    <h3 class="mb-3">{{ eventId ? 'Edit Event' : 'New Event' }}</h3>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="loading" class="alert alert-info">Loading...</div>

    <form v-else @submit.prevent="onSubmit" class="row g-3">
      <!-- Title -->
      <div class="col-md-8">
        <label class="form-label">Title</label>
        <input v-model="form.title" type="text" class="form-control" placeholder="e.g., Dragon Boat Dumpling Workshop" required>
      </div>

      <!-- Category -->
      <div class="col-md-4">
        <label class="form-label">Category</label>
        <input v-model="form.category" type="text" class="form-control" placeholder="e.g., Festival" required>
      </div>

      <!-- Start / End (local datetime) -->
      <div class="col-md-6">
        <label class="form-label">Start (local)</label>
        <input v-model="form.startAt" type="datetime-local" class="form-control" required>
      </div>
      <div class="col-md-6">
        <label class="form-label">End (local)</label>
        <input v-model="form.endAt" type="datetime-local" class="form-control" required>
      </div>

      <!-- Capacity / Seats Left -->
      <div class="col-md-6">
        <label class="form-label">Capacity</label>
        <input v-model.number="form.capacity" type="number" min="1" class="form-control" placeholder="e.g., 50" required>
      </div>
      <div class="col-md-6">
        <label class="form-label">Seats Left</label>
        <input v-model.number="form.seatsLeft" type="number" min="0" class="form-control" placeholder="(default = Capacity)">
      </div>

      <!-- Image URL -->
      <div class="col-12">
        <label class="form-label">Image URL</label>
        <input v-model="form.imageUrl" type="url" class="form-control" placeholder="https://...">
      </div>

      <!-- Description -->
      <div class="col-12">
        <label class="form-label">Description</label>
        <textarea v-model="form.description" rows="3" class="form-control" placeholder="Brief description..."></textarea>
      </div>

      <!-- Location -->
      <div class="col-12">
        <h6 class="mt-2">Location</h6>
      </div>
      <div class="col-md-6">
        <label class="form-label">Name</label>
        <input v-model="form.location.name" type="text" class="form-control" placeholder="e.g., Campus Hub Kitchen">
      </div>
      <div class="col-md-6">
        <label class="form-label">Address</label>
        <input v-model="form.location.address" type="text" class="form-control" placeholder="e.g., Clayton">
      </div>
      <div class="col-md-6">
        <label class="form-label">Latitude</label>
        <input v-model.number="form.location.lat" type="number" step="0.00001" class="form-control" placeholder="-37.91">
      </div>
      <div class="col-md-6">
        <label class="form-label">Longitude</label>
        <input v-model.number="form.location.lng" type="number" step="0.00001" class="form-control" placeholder="145.13">
      </div>

      <!-- Tags (comma separated) -->
      <div class="col-12">
        <label class="form-label">Tags (comma separated)</label>
        <input
          :value="form.tags.join(', ')"
          @input="form.tags = $event.target.value.split(',').map(s => s.trim()).filter(Boolean)"
          type="text"
          class="form-control"
          placeholder="e.g., traditional, vegan-option"
        >
      </div>

      <!-- Buttons -->
      <div class="col-12 d-flex gap-2 mt-2">
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <button type="button" class="btn btn-outline-secondary" @click="router.push('/admin/events')">Cancel</button>
      </div>
    </form>
  </div>
</template>
