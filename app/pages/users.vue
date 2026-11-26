<script setup lang="ts">
  /**
   * Purpose
   * Render the users part of the ESA interface.
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
  import type { UserRead } from '#server/services/userService'
  import { authClient } from '~/utils/auth-client'
  import { errorMessage } from '~/utils/errors'

  // Define { data: users, pending, error, refresh } for the steps below.
  const { data: users, pending, error, refresh } = await useFetch<UserRead[]>('/api/users')
  // Define { data: session } for the steps below.
  const { data: session } = await authClient.useSession(useFetch)

  // Use useToast to initialize toast.
  const toast = useToast()
  // Use useConfirm to initialize confirm.
  const confirm = useConfirm()
  // Store busyId as state so Vue reacts when it changes.
  const busyId = ref<string | null>(null)

  // Recalculate myId when the values it reads change.
  const myId = computed(() => session.value?.user.id)
  // Recalculate activeUsers when the values it reads change.
  const activeUsers = computed(() => (users.value ?? []).filter((u) => u.active))
  // Recalculate inactiveUsers when the values it reads change.
  const inactiveUsers = computed(() => (users.value ?? []).filter((u) => !u.active))
  // Recalculate adminCount when the values it reads change.
  const adminCount = computed(() => (users.value ?? []).filter((u) => u.role === 'ADMIN').length)

  // Define the helper that will get image link.
  function getImageLink(user: { image: boolean; id: string }) {
    // Pass user.image ? 'api/users/' + user.id + '/profile' : undefined back to the caller.
    return user.image ? 'api/users/' + user.id + '/profile' : undefined
  }

  // Self is the only admin and would demote out of the role entirely — the server rejects this
  // too, but disabling it here avoids a round-trip just to show the error.
  function canDemote(user: UserRead) {
    // Pass user.id !== myId.value || adminCount.value > 1 back to the caller.
    return user.id !== myId.value || adminCount.value > 1
  }

  // Define the helper that will update user.
  async function updateUser(id: string, data: { active?: boolean; role?: 'USER' | 'ADMIN' }) {
    // Update busyId.value with the value on the right.
    busyId.value = id
    try {
      await $fetch(`/api/users/${id}`, { method: 'PUT', body: data })
      await refresh()
    } catch (err) {
      // Call toast.add to run this step.
      toast.add({ title: 'Update failed', description: errorMessage(err), color: 'error' })
    } finally {
      // Update busyId.value with the value on the right.
      busyId.value = null
    }
  }

  // Define activate for the steps below.
  const activate = (user: UserRead) => updateUser(user.id, { active: true })
  // Define deactivate for the steps below.
  const deactivate = (user: UserRead) => updateUser(user.id, { active: false })
  // Define promote for the steps below.
  const promote = (user: UserRead) => updateUser(user.id, { role: 'ADMIN' })

  // Define the helper that will demote.
  async function demote(user: UserRead) {
    // Define ok for the steps below.
    const ok = await confirm({
      title: `Demote ${user.name}?`,
      description: `${user.name} will lose admin access to this application.`,
      confirmLabel: 'Demote',
    })
    // Check whether !ok before running this branch.
    if (!ok) return
    await updateUser(user.id, { role: 'USER' })
  }

  // Define the helper that will remove user.
  async function removeUser(user: UserRead) {
    // Update busyId.value with the value on the right.
    busyId.value = user.id
    try {
      await $fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      await refresh()
    } catch (err) {
      // Call toast.add to run this step.
      toast.add({ title: 'Delete failed', description: errorMessage(err), color: 'error' })
    } finally {
      // Update busyId.value with the value on the right.
      busyId.value = null
    }
  }
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        User Management
      </h1>
      <p class="mt-1 text-gray-500 dark:text-gray-400">Registered users of the application.</p>
    </div>

    <div v-if="pending" class="space-y-4">
      <div v-for="i in 3" :key="i" class="flex items-center justify-between py-2">
        <div class="flex w-full items-center gap-3">
          <USkeleton class="h-10 w-10 rounded-full" />
          <div class="w-full max-w-[200px] space-y-2">
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-3 w-2/3" />
          </div>
        </div>
      </div>
    </div>

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-triangle-20-solid"
      color="error"
      variant="subtle"
      title="Error loading users"
      :description="error.message"
    />

    <div v-else class="space-y-8">
      <UCard class="w-full">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle-20-solid" class="h-5 w-5 text-gray-500" />
              <h2 class="text-base leading-7 font-semibold text-gray-900 dark:text-white">
                Active Users
              </h2>
            </div>
            <UBadge variant="subtle" color="primary" size="md">
              {{ activeUsers.length }} Users
            </UBadge>
          </div>
        </template>

        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          <div
            v-for="user in activeUsers"
            :key="user.id"
            class="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div class="flex items-center gap-3">
              <UAvatar :src="getImageLink(user)" :alt="user.name" size="md" :as="{ img: 'img' }" />
              <div>
                <div class="flex items-center gap-2">
                  <p class="font-medium text-gray-900 dark:text-white">{{ user.name }}</p>
                  <UBadge v-if="user.role === 'ADMIN'" color="neutral" variant="subtle" size="sm">
                    Admin
                  </UBadge>
                  <UBadge v-if="user.id === myId" color="primary" variant="subtle" size="sm">
                    You
                  </UBadge>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ user.email }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UButton
                v-if="user.role === 'USER'"
                label="Promote to Admin"
                color="neutral"
                variant="subtle"
                size="sm"
                :loading="busyId === user.id"
                @click="promote(user)"
              />
              <UTooltip
                v-else
                :text="canDemote(user) ? undefined : 'At least one other admin must exist first'"
              >
                <UButton
                  label="Demote to User"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  :disabled="!canDemote(user)"
                  :loading="busyId === user.id"
                  @click="demote(user)"
                />
              </UTooltip>

              <UTooltip
                :text="user.id === myId ? 'You cannot deactivate your own account' : undefined"
              >
                <UButton
                  label="Deactivate"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  :disabled="user.id === myId"
                  :loading="busyId === user.id"
                  @click="deactivate(user)"
                />
              </UTooltip>
            </div>
          </div>

          <div v-if="activeUsers.length === 0" class="py-8 text-center text-gray-500">
            No active users.
          </div>
        </div>
      </UCard>

      <UCard class="w-full">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-no-symbol-20-solid" class="h-5 w-5 text-gray-500" />
              <h2 class="text-base leading-7 font-semibold text-gray-900 dark:text-white">
                Inactive Users
              </h2>
            </div>
            <UBadge variant="subtle" color="neutral" size="md">
              {{ inactiveUsers.length }} Users
            </UBadge>
          </div>
        </template>

        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          <div
            v-for="user in inactiveUsers"
            :key="user.id"
            class="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div class="flex items-center gap-3">
              <UAvatar :src="getImageLink(user)" :alt="user.name" size="md" :as="{ img: 'img' }" />
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{{ user.name }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ user.email }}</p>
              </div>
              <UBadge
                :color="user.emailVerified ? 'success' : 'warning'"
                variant="subtle"
                size="sm"
              >
                {{ user.emailVerified ? 'Verified' : 'Pending' }}
              </UBadge>
            </div>

            <div class="flex items-center gap-2">
              <UButton
                label="Activate"
                color="success"
                variant="subtle"
                size="sm"
                :loading="busyId === user.id"
                @click="activate(user)"
              />
              <UButton
                label="Delete"
                color="error"
                variant="subtle"
                size="sm"
                :loading="busyId === user.id"
                @click="removeUser(user)"
              />
            </div>
          </div>

          <div v-if="inactiveUsers.length === 0" class="py-8 text-center text-gray-500">
            No inactive users.
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
