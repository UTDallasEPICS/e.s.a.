<script setup lang="ts">
  import type { UserRead } from '#server/services/userService'
  import { authClient } from '~/utils/auth-client'
  import { errorMessage } from '~/utils/errors'

  const { data: users, pending, error, refresh } = await useFetch<UserRead[]>('/api/users')
  const { data: session } = await authClient.useSession(useFetch)

  const toast = useToast()
  const confirm = useConfirm()
  const busyId = ref<string | null>(null)

  const myId = computed(() => session.value?.user.id)
  const activeUsers = computed(() => (users.value ?? []).filter((u) => u.active))
  const inactiveUsers = computed(() => (users.value ?? []).filter((u) => !u.active))
  const adminCount = computed(() => (users.value ?? []).filter((u) => u.role === 'ADMIN').length)

  function getImageLink(user: { image: boolean; id: string }) {
    return user.image ? 'api/users/' + user.id + '/profile' : undefined
  }

  // Self is the only admin and would demote out of the role entirely — the server rejects this
  // too, but disabling it here avoids a round-trip just to show the error.
  function canDemote(user: UserRead) {
    return user.id !== myId.value || adminCount.value > 1
  }

  async function updateUser(id: string, data: { active?: boolean; role?: 'USER' | 'ADMIN' }) {
    busyId.value = id
    try {
      await $fetch(`/api/users/${id}`, { method: 'PUT', body: data })
      await refresh()
    } catch (err) {
      toast.add({ title: 'Update failed', description: errorMessage(err), color: 'error' })
    } finally {
      busyId.value = null
    }
  }

  const activate = (user: UserRead) => updateUser(user.id, { active: true })
  const deactivate = (user: UserRead) => updateUser(user.id, { active: false })
  const promote = (user: UserRead) => updateUser(user.id, { role: 'ADMIN' })

  async function demote(user: UserRead) {
    const ok = await confirm({
      title: `Demote ${user.name}?`,
      description: `${user.name} will lose admin access to this application.`,
      confirmLabel: 'Demote',
    })
    if (!ok) return
    await updateUser(user.id, { role: 'USER' })
  }

  async function removeUser(user: UserRead) {
    busyId.value = user.id
    try {
      await $fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      await refresh()
    } catch (err) {
      toast.add({ title: 'Delete failed', description: errorMessage(err), color: 'error' })
    } finally {
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
