<script setup lang="ts">
  /**
   * Purpose
   * Render the database part of the ESA interface.
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
  // The page owns the semester filter and the active tab, and gates both: a tab holding staged
  // changes is asked before either moves. Switching tabs matters as much as switching semester —
  // UTabs unmounts the inactive panel, which would take its staged work with it silently (§2.3.2).

  const { semesterId, request, confirmDiscard } = provideSemesterFilter()

  // Define items for the steps below.
  const items = [
    { label: 'Projects', value: 'projects', slot: 'projects' as const },
    { label: 'Students', value: 'students', slot: 'students' as const },
    { label: 'Partners', value: 'partners', slot: 'partners' as const },
  ]

  // Store activeTab as state so Vue reacts when it changes.
  const activeTab = ref('projects')

  // Define the helper that will set tab.
  async function setTab(next: any) {
    // Use String to initialize value.
    const value = String(next)
    // Check whether value === activeTab.value before running this branch.
    if (value === activeTab.value) return
    // Check whether await confirmDiscard('Switching tabs will discard everything you have staged here.') before running this branch.
    if (await confirmDiscard('Switching tabs will discard everything you have staged here.')) {
      // Update activeTab.value with the value on the right.
      activeTab.value = value
    }
  }
</script>

<template>
  <UContainer class="space-y-6 py-8">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Database</h1>
      <SemesterFilter :model-value="semesterId" @update:model-value="request" />
    </div>

    <UTabs :items="items" :model-value="activeTab" class="w-full" @update:model-value="setTab">
      <template #projects><ProjectsTab /></template>
      <template #students><StudentsTab /></template>
      <template #partners><PartnersTab /></template>
    </UTabs>
  </UContainer>
</template>
