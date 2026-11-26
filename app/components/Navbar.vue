<script setup lang="ts">
  /**
   * Purpose
   * Render the navbar part of the ESA interface.
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
  import type { NavigationMenuItem } from '@nuxt/ui'
  import { authClient } from '../utils/auth-client'

  // Define { data: session } for the steps below.
  const { data: session } = await authClient.useSession(useFetch)

  // Recalculate items when the values it reads change.
  const items = computed<NavigationMenuItem[]>(() => [
    { label: 'Database', icon: 'i-heroicons-circle-stack', to: '/database' },
    { label: 'Team Formation', icon: 'i-heroicons-user-group', to: '/team-formation' },
    { label: 'Automation', icon: 'i-heroicons-bolt', to: '/automation' },
    ...(session.value?.user.role === 'ADMIN'
      ? [{ label: 'User Management', icon: 'i-heroicons-shield-check', to: '/users' }]
      : []),
  ])

  // Define the helper that will logout.
  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }
</script>

<template>
  <UNavigationMenu :items="items" class="w-full" />
  <UButton
    label="Logout"
    icon="i-heroicons-arrow-right-on-rectangle"
    color="neutral"
    variant="ghost"
    @click="logout"
  />
</template>
