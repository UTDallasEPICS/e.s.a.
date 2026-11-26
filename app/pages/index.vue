<script setup lang="ts">
  /**
   * Purpose
   * Render the index part of the ESA interface.
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
  import { authClient } from '../utils/auth-client'

  // Store selectedFile as state so Vue reacts when it changes.
  const selectedFile = ref<File | null>(null)
  // Store imagePreview as state so Vue reacts when it changes.
  const imagePreview = ref<string>('')
  // Store isUploading as state so Vue reacts when it changes.
  const isUploading = ref(false)
  // Store isModalOpen as state so Vue reacts when it changes.
  const isModalOpen = ref(false)

  // Define the helper that will logout.
  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }

  // Define the helper that will handle image upload.
  function handleImageUpload(event: Event) {
    // Define target for the steps below.
    const target = event.target as HTMLInputElement
    // Define files for the steps below.
    const files = target.files as FileList

    // Check whether !files || files.length === 0 before running this branch.
    if (!files || files.length === 0) return

    // Define file for the steps below.
    const file = files[0]

    // Check whether !file?.type.startsWith('image/') before running this branch.
    if (!file?.type.startsWith('image/')) {
      return
    }

    // Update selectedFile.value with the value on the right.
    selectedFile.value = file

    // Define reader for the steps below.
    const reader = new FileReader()
    // Update reader.onload with the value on the right.
    reader.onload = (e) => {
      // Update imagePreview.value with the value on the right.
      imagePreview.value = e.target?.result as string
    }
    // Call reader.readAsDataURL to run this step.
    reader.readAsDataURL(file)
  }

  // Define openModal for the steps below.
  const openModal = () => {
    // Update isModalOpen.value with the value on the right.
    isModalOpen.value = true
  }

  // Define closeModal for the steps below.
  const closeModal = () => {
    // Update isModalOpen.value with the value on the right.
    isModalOpen.value = false
  }

  // Define the helper that will update pfp.
  async function updatePfp() {
    // Check whether !selectedFile.value before running this branch.
    if (!selectedFile.value) return

    // Update isUploading.value with the value on the right.
    isUploading.value = true

    try {
      // Define formData for the steps below.
      const formData = new FormData()
      // Call formData.append to run this step.
      formData.append('file', selectedFile.value)

      await $fetch('/api/users/upload', {
        method: 'POST',
        body: formData,
      })

      // Refresh users data to show updated profile picture
      await refreshNuxtData()

      // Reset state
      selectedFile.value = null
      // Update imagePreview.value with the value on the right.
      imagePreview.value = ''
      // Update isModalOpen.value with the value on the right.
      isModalOpen.value = false
    } catch (error) {
      // Call console.error to run this step.
      console.error('Upload failed:', error)
    } finally {
      // Update isUploading.value with the value on the right.
      isUploading.value = false
    }
  }
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
        <p class="mt-1 text-gray-500 dark:text-gray-400">Manage your account settings.</p>
      </div>
      <div class="flex justify-between gap-4 md:items-center">
        <UModal :open="isModalOpen">
          <UButton
            color="success"
            variant="soft"
            @click="openModal"
            icon="i-heroicons-arrow-up-on-square-20-solid"
            label="Update Profile Picture"
          />

          <template #content>
            <div class="m-12 space-y-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                Update Profile Picture
              </h3>

              <div v-if="imagePreview" class="flex justify-center">
                <UAvatar :src="imagePreview" size="3xl" />
              </div>

              <div>
                <input
                  type="file"
                  accept="image/*"
                  class="file:bg-primary-50 file:text-brand4 hover:file:bg-primary-100 block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold"
                  @change="handleImageUpload"
                />
              </div>

              <div class="flex justify-end gap-2">
                <UButton variant="soft" @click="closeModal"> Cancel </UButton>
                <UButton
                  color="success"
                  :loading="isUploading"
                  :disabled="!selectedFile"
                  @click="updatePfp"
                >
                  Upload
                </UButton>
              </div>
            </div>
          </template>
        </UModal>
        <UButton
          color="error"
          variant="soft"
          icon="i-heroicons-arrow-right-on-rectangle-20-solid"
          label="Logout"
          @click="logout"
        />
      </div>
    </div>
  </UContainer>
</template>
