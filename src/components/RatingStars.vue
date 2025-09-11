<script setup>
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  readonly:   { type: Boolean, default: false },
  size:       { type: String, default: '22px' },
  title:      { type: String, default: 'Rate' }
})
const emit = defineEmits(['update:modelValue', 'change'])
const stars = [1,2,3,4,5]

const styleStar = (n) => ({
  cursor: props.readonly ? 'default' : 'pointer',
  fontSize: props.size,
  lineHeight: 1,
  transition: 'transform .1s ease',
  color: n <= (props.modelValue || 0) ? '#ffc107' : '#e0e0e0',
})

function set(n){
  if (!props.readonly){
    emit('update:modelValue', n)
    emit('change', n)
  }
}
</script>

<template>
  <div class="d-inline-flex align-items-center" :aria-label="title" role="radiogroup">
    <button
      v-for="n in stars" :key="n" type="button"
      class="btn p-0 border-0 bg-transparent"
      :style="styleStar(n)"
      :aria-checked="modelValue===n" role="radio"
      :title="`${n} star${n>1?'s':''}`"
      @click="set(n)"
      @keydown.enter.prevent="set(n)"
    >★</button>
  </div>
</template>

<style scoped>
button:focus{ outline: none; }
button:not([disabled]):hover{ transform: scale(1.08); }
</style>
