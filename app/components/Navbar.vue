<script setup lang="ts">
  import type { NavigationMenuItem } from '@nuxt/ui'
  import { authClient } from '../utils/auth-client'

  const props = withDefaults(defineProps<{ orientation?: 'horizontal' | 'vertical' }>(), {
    orientation: 'horizontal',
  })

  const { data: session } = await authClient.useSession(useFetch)

  const items = computed<NavigationMenuItem[]>(() => [
    { label: 'Database', icon: 'i-heroicons-circle-stack', to: '/database' },
    { label: 'Team Formation', icon: 'i-heroicons-user-group', to: '/team-formation' },
    { label: 'Automation', icon: 'i-heroicons-bolt', to: '/automation' },
    ...(session.value?.user.role === 'ADMIN'
      ? [{ label: 'User Management', icon: 'i-heroicons-shield-check', to: '/users' }]
      : []),
  ])

  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }
</script>

<template>
  <UNavigationMenu :items="items" :orientation="props.orientation" class="w-full" />
  <UButton
    label="Logout"
    icon="i-heroicons-arrow-right-on-rectangle"
    color="neutral"
    variant="ghost"
    @click="logout"
  />
</template>
