<script setup lang="ts">
  /**
   * Purpose
   * Render the auth part of the ESA interface.
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
// Store email as state so Vue reacts when it changes.
const email = ref('')
// Store password as state so Vue reacts when it changes.
const password = ref('')
// Store confirmation as state so Vue reacts when it changes.
const confirmation = ref('')
// Store setupToken as state so Vue reacts when it changes.
const setupToken = ref('')
// Store ready as state so Vue reacts when it changes.
const ready = ref(false)
// Store busy as state so Vue reacts when it changes.
const busy = ref(false)
// Store message as state so Vue reacts when it changes.
const message = ref('')
// Store success as state so Vue reacts when it changes.
const success = ref(false)
// Call onMounted to run this step.
onMounted(() => {
  // Define fragment for the steps below.
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  // Update setupToken.value with the value on the right.
  setupToken.value = fragment.get('setup') ?? ''
  // Update email.value with the value on the right.
  email.value = fragment.get('email') ?? ''
  // Check whether setupToken.value before running this branch.
  if (setupToken.value) window.history.replaceState(null, '', window.location.pathname)
  // Update ready.value with the value on the right.
  ready.value = true
})
// Define the helper that will submit.
async function submit() {
  // Check whether busy.value before running this branch.
  if (busy.value) return
  // Update message.value with the value on the right.
  message.value = ''
  // Update success.value with the value on the right.
  success.value = false
  // Check whether setupToken.value && password.value !== confirmation.value before running this branch.
  if (setupToken.value && password.value !== confirmation.value) {
    // Update message.value with the value on the right.
    message.value = 'The passwords do not match.'
    return
  }
  // Update busy.value with the value on the right.
  busy.value = true
  try {
    // Check whether setupToken.value before running this branch.
    if (setupToken.value) {
      // Define { error } for the steps below.
      const { error } = await authClient.resetPassword({ token: setupToken.value, newPassword: password.value })
      // Check whether error before running this branch.
      if (error) { message.value = error.message || 'This setup link has expired. Ask for a new setup link.'; return }
      // Update setupToken.value with the value on the right.
      setupToken.value = ''
      // Update confirmation.value with the value on the right.
      confirmation.value = ''
      // Update success.value with the value on the right.
      success.value = true
      // Update message.value with the value on the right.
      message.value = 'Password saved. Signing you in...'
    }
    // Define { error } for the steps below.
    const { error } = await authClient.signIn.email({ email: email.value.trim(), password: password.value })
    // Check whether error before running this branch.
    if (error) {
      // Update success.value with the value on the right.
      success.value = false
      // Update message.value with the value on the right.
      message.value = 'Unable to sign in. Check your ESA email and password.'
      return
    }
    // Update password.value with the value on the right.
    password.value = ''
    await navigateTo('/database-redesign', { external: true })
  } catch {
    // Update success.value with the value on the right.
    success.value = false
    // Update message.value with the value on the right.
    message.value = 'Unable to connect. Please try again.'
  } finally { busy.value = false }
}
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center px-4 py-12">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">{{ setupToken ? 'Create your ESA password' : 'Sign in to ESA' }}</h1>
        <p class="mt-2 text-sm text-gray-500">{{ setupToken ? 'Choose a password for this local ESA copy. This is separate from your Gmail password.' : 'Use your ESA email and password. No emailed code is needed.' }}</p>
      </template>
      <form v-if="ready" @submit.prevent="submit" class="space-y-5">
        <div>
          <label for="esa-email" class="mb-1 block text-sm font-medium">Email</label>
          <input id="esa-email" v-model="email" type="email" required :readonly="!!setupToken" autocomplete="username" class="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white" />
        </div>
        <div>
          <label for="esa-password" class="mb-1 block text-sm font-medium">{{ setupToken ? 'Choose an ESA password' : 'Password' }}</label>
          <input id="esa-password" v-model="password" type="password" required :minlength="setupToken ? 8 : undefined" maxlength="128" :autocomplete="setupToken ? 'new-password' : 'current-password'" class="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white" />
          <p v-if="setupToken" class="mt-1 text-sm text-gray-500">Use at least 8 characters.</p>
        </div>
        <div v-if="setupToken">
          <label for="esa-confirm-password" class="mb-1 block text-sm font-medium">Confirm ESA password</label>
          <input id="esa-confirm-password" v-model="confirmation" type="password" required minlength="8" maxlength="128" autocomplete="new-password" class="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white" />
        </div>
        <p v-if="message" role="status" :class="success ? 'text-green-700' : 'text-red-700'">{{ message }}</p>
        <UButton type="submit" :loading="busy" :disabled="busy" class="w-full justify-center">{{ setupToken ? 'Save password and sign in' : 'Sign in' }}</UButton>
      </form>
      <p v-else>Loading sign-in...</p>
    </UCard>
  </div>
</template>
