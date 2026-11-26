<script setup lang="ts">
  /**
   * Purpose
   * Render the contact form modal part of the ESA interface.
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
  import ModalFooter from '~/components/modals/ModalFooter.vue'
  import type { ContactDraft } from '~/utils/recordDrafts'

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ close: [contact: ContactDraft | null] }>()

  // Use reactive to initialize draft.
  const draft = reactive({ name: '', email: '', phone: '' })

  // Define the helper that will on confirm.
  function onConfirm() {
    // Check whether !draft.name.trim() before running this branch.
    if (!draft.name.trim()) return
    // Call emit to run this step.
    emit('close', {
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim() || undefined,
    })
  }
</script>

<template>
  <UModal title="Add Contact" @close="emit('close', null)">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Name" required>
          <UInput v-model="draft.name" class="w-full" />
        </UFormField>
        <UFormField label="Phone">
          <UInput v-model="draft.phone" class="w-full" />
        </UFormField>
        <UFormField label="Email">
          <UInput v-model="draft.email" class="w-full" />
        </UFormField>
        <ModalFooter
          :disabled="!draft.name.trim()"
          @cancel="emit('close', null)"
          @confirm="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
