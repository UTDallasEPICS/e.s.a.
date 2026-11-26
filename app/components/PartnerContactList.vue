<script setup lang="ts">
  /**
   * Purpose
   * Render the partner contact list part of the ESA interface.
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
  import { ACTION_ICONS } from '~/utils/icons'
  import type { ContactRead } from '#server/services/contactService'
  import type { PartnerRead } from '#server/services/partnerService'

  /** A merged contact plus whether it is the partner's primary once staging is applied. */
  interface ContactCard extends MergedChild<ContactRead> {
    isPrimary: boolean
  }

  type ContactField = 'name' | 'email' | 'phone'

  // Define CONTACT_FIELDS for the steps below.
  const CONTACT_FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
  ] as const

  // Use defineProps to initialize props.
  const props = defineProps<{
    rowId: string
    row: PartnerRead
    /** The partner row itself is marked for deletion, so its contacts are read-only. */
    disabled?: boolean
  }>()

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{ add: [] }>()

  // Use useRowStaging to initialize { staging, saving }.
  const { staging, saving } = useRowStaging()

  // Define the helper that will contact value.
  function contactValue(contactId: string, field: ContactField) {
    // Pass staging.children.get(props.rowId, 'Contacts', contactId, field) ?? '' back to the caller.
    return staging.children.get(props.rowId, 'Contacts', contactId, field) ?? ''
  }

  // Define the helper that will set contact.
  function setContact(contactId: string, field: ContactField, value: any) {
    // Call staging.children.set to run this step.
    staging.children.set(props.rowId, 'Contacts', contactId, field, value ?? '')
  }

  // Define the helper that will contact edited.
  function contactEdited(contactId: string, field: ContactField) {
    // Pass staging.children.isEdited(props.rowId, 'Contacts', contactId, field) back to the caller.
    return staging.children.isEdited(props.rowId, 'Contacts', contactId, field)
  }

  /** Fetched contacts with staged edits applied, plus staged-new ones, flagged with the primary. */
  const cards = computed<ContactCard[]>(() => {
    // Use staging.children.merge to initialize merged.
    const merged = staging.children.merge<ContactRead>(props.rowId, 'Contacts')
    // Use merged.filter to initialize live.
    const live = merged.filter((card) => !card.deleted)
    // Define primaryId for the steps below.
    const primaryId = (live.find((card) => card.record?.isPrimary) ?? live[0])?.id
    // Pass merged.map((card) => ({ ...card, isPrimary: card.id === primaryId })) back to the caller.
    return merged.map((card) => ({ ...card, isPrimary: card.id === primaryId }))
  })

  /** Promotes one contact and clears the flag on the previous primary, both staged locally. */
  function makePrimary(id: string) {
    // Use cards.value.find to initialize current.
    const current = cards.value.find((card) => card.isPrimary)
    // Check whether current && current.id !== id before running this branch.
    if (current && current.id !== id) {
      // Call staging.children.set to run this step.
      staging.children.set(props.rowId, 'Contacts', current.id, 'isPrimary', false)
    }
    // Call staging.children.set to run this step.
    staging.children.set(props.rowId, 'Contacts', id, 'isPrimary', true)
  }
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">Contacts</h3>
      <UButton
        label="Add Contact"
        :icon="ACTION_ICONS.add"
        size="xs"
        variant="soft"
        :disabled="disabled || saving"
        @click="emit('add')"
      />
    </div>

    <p v-if="!cards.length" class="text-sm text-gray-500">No contacts yet.</p>

    <ul class="space-y-2">
      <li
        v-for="contact in cards"
        :key="contact.id"
        class="rounded border border-gray-200 p-2 dark:border-gray-800"
        :class="STAGE_TINTS[contact.state]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <UFormField
              v-for="field in CONTACT_FIELDS"
              :key="field.key"
              :label="field.label"
              size="xs"
            >
              <UInput
                :model-value="contactValue(contact.id, field.key)"
                variant="ghost"
                size="xs"
                placeholder="—"
                class="w-full"
                color="warning"
                :highlight="contactEdited(contact.id, field.key)"
                :disabled="disabled || contact.deleted || saving"
                @update:model-value="(value: any) => setContact(contact.id, field.key, value)"
              />
            </UFormField>
          </div>

          <div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <UBadge v-if="contact.isPrimary" size="xs" variant="subtle">Primary</UBadge>
            <UButton
              v-if="!contact.isPrimary && !contact.deleted"
              label="Make Primary"
              :icon="ACTION_ICONS.primary"
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="disabled || saving"
              @click="makePrimary(contact.id)"
            />
            <UButton
              v-if="contact.state === 'clean' || contact.state === 'edited'"
              label="Delete"
              :icon="ACTION_ICONS.delete"
              size="xs"
              color="error"
              variant="ghost"
              :disabled="disabled || saving"
              @click="staging.children.markDeleted(rowId, 'Contacts', contact.id)"
            />
            <UButton
              v-if="contact.state !== 'clean'"
              label="Undo"
              :icon="ACTION_ICONS.undo"
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="disabled || saving"
              @click="staging.children.undo(rowId, 'Contacts', contact.id)"
            />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
