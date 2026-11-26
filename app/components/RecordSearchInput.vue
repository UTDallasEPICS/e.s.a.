<script setup lang="ts" generic="T extends Record<string, any>
  /**
   * Purpose
   * Render the record search input part of the ESA interface.
   *
   * Inputs
   * - The component’s props, shared state, and any user actions it handles.
   *
   * Outputs
   * - Rendered controls or content, plus events exposed to the parent where applicable.
   *
   * Pseudocode
   * Read the inputs → prepare values for display → render the template → respond to user actions.
   */">
  // Use defineProps to initialize props.
  const props = defineProps<{
    search: (query: string) => Promise<T[]>
    displayLabel: (item: T) => string
    placeholder?: string
    disabled?: boolean
    highlight?: boolean
    color?: string
  }>()

  // Use defineModel to initialize modelValue.
  const modelValue = defineModel<T | undefined>()

  // Store searchTerm as state so Vue reacts when it changes.
  const searchTerm = ref('')
  // Store results as state so Vue reacts when it changes.
  const results = ref<T[]>([])
  // Store loading as state so Vue reacts when it changes.
  const loading = ref(false)

  // Recalculate items when the values it reads change.
  const items = computed(() =>
    results.value.map((item) => ({ label: props.displayLabel(item), record: item }))
  )

  // Define searchToken for the steps below.
  let searchToken = 0
  // Run the callback when the watched values change.
  watch(
    searchTerm,
    async (query) => {
      // Define token for the steps below.
      const token = ++searchToken
      // Update loading.value with the value on the right.
      loading.value = true
      // Define found for the steps below.
      const found = await props.search(query)
      // Check whether token === searchToken before running this branch.
      if (token === searchToken) {
        // Update results.value with the value on the right.
        results.value = found
        // Update loading.value with the value on the right.
        loading.value = false
      }
    },
    { immediate: true }
  )

  // Recalculate selectedItem when the values it reads change.
  const selectedItem = computed(() =>
    modelValue.value
      ? { label: props.displayLabel(modelValue.value), record: modelValue.value }
      : undefined
  )
</script>

<template>
  <USelectMenu
    :model-value="selectedItem"
    v-model:search-term="searchTerm"
    :items="items"
    :loading="loading"
    ignore-filter
    :disabled="disabled"
    :highlight="highlight"
    :color="color as any"
    :placeholder="placeholder ?? 'Search…'"
    @update:model-value="(v: any) => (modelValue = v?.record)"
  />
</template>
