<template>
<!--
Purpose
Render the inactive part of the ESA interface.

Inputs
- The component’s props, shared state, and any user actions it handles.

Outputs
- Rendered controls or content, plus events exposed to the parent where applicable.

Pseudocode
Read the inputs → prepare values for display → render the template → respond to user actions.
-->

  <UContainer class="flex min-h-[70vh] items-center justify-center py-12">
    <UCard class="max-w-md text-center">
      <div class="flex flex-col items-center gap-4">
        <UIcon name="i-heroicons-lock-closed" class="h-10 w-10 text-gray-400" />
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Account Inactive</h1>
        <p class="text-gray-500 dark:text-gray-400">
          Your account has not been activated yet. Please contact an administrator for approval.
        </p>
      </div>
    </UCard>
  </UContainer>
</template>
