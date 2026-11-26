<script setup lang="ts">
  /**
   * Purpose
   * Render the app part of the ESA interface.
   *
   * Inputs
   * - The component’s props, shared state, and any user actions it handles.
   *
   * Outputs
   * - Rendered controls or content, plus events exposed to the parent where applicable.
   *
   * Pseudocode
   * Read the inputs → prepare values for display → render the template → respond to user actions.
   */
  import { useColorMode, useRoute } from '#imports'
  import { computed } from 'vue'
  // Use useColorMode to initialize colorMode.
  const colorMode = useColorMode()

  // Use useRoute to initialize route.
  const route = useRoute()
  // Recalculate isRedesign when the values it reads change.
  const isRedesign = computed(() => route.path === '/database-redesign')

  // Recalculate isDark when the values it reads change.
  const isDark = computed({
    get() {
      // Pass colorMode.value === 'dark' back to the caller.
      return colorMode.value === 'dark'
    },
    set() {
      // Update colorMode.preference with the value on the right.
      colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
    },
  })
</script>

<template>
  <UApp>
    <div
      class="flex min-h-screen flex-col bg-white text-gray-900 transition-colors duration-300 dark:bg-gray-900 dark:text-gray-100"
    >
      <header
        v-if="!isRedesign"
        class="sticky top-0 z-50 border-b border-gray-200 bg-white/75 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/75"
      >
        <UContainer class="flex h-16 items-center justify-between gap-4">
          <NuxtLink to="/" class="flex shrink-0 items-center gap-2 text-xl font-bold">
            <UIcon name="i-heroicons-cube-transparent" class="text-primary-500 h-8 w-8" />
            <span>ESA</span>
          </NuxtLink>

          <div class="flex flex-1 items-center justify-between gap-2">
            <Navbar />

            <UButton
              :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
              color="neutral"
              variant="ghost"
              @click="isDark = !isDark"
              aria-label="Toggle Theme"
            />
          </div>
        </UContainer>
      </header>

      <main class="flex-1">
        <NuxtPage />
      </main>
    </div>
  </UApp>
</template>
