<script setup lang="ts">
  const colorMode = useColorMode()

  // Team Formation has its own side menu (≡) instead of the top bar.
  const route = useRoute()
  const showHeader = computed(() => route.path !== '/team-formation')

  const isDark = computed({
    get() {
      return colorMode.value === 'dark'
    },
    set() {
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
        v-if="showHeader"
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
