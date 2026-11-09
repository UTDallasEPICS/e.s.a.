<script setup lang="ts">
  import { parseCsv, validateBidRows, type BidRowError } from '~/utils/bidCsv'
  import { titleCase } from '~/utils/labels'
  import type { TableColumn } from '@nuxt/ui'
  import type { BidFileRead } from '#server/services/bidFileService'

  const props = defineProps<{
    semesterId?: string
    meetingDay: 'WEDNESDAY' | 'THURSDAY'
    /** Students with bids already saved for this semester/day. */
    savedCount: number
  }>()
  const emit = defineEmits<{ imported: [] }>()

  const bidFile = ref<File | null>(null)
  const parsedRows = ref<Record<string, string>[]>([])
  const parseErrors = ref<BidRowError[]>([])
  const missingColumns = ref<string[]>([])
  const uploadResult = ref<{
    studentsImported: number
    choicesCreated: number
    skippedStudents: string[]
    noBidPlacements: { name: string; netID: string; major: string; projectName: string }[]
    noBidUnplaced: string[]
  } | null>(null)
  const uploading = ref(false)
  const uploadError = ref<string | null>(null)

  watch(bidFile, async (file, _, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    parsedRows.value = []
    parseErrors.value = []
    missingColumns.value = []
    if (!file) return

    // Only clear prior results once a new file is actually chosen, so a successful
    // upload's summary stays visible after we reset `bidFile` below.
    uploadResult.value = null
    uploadError.value = null

    let text: string
    try {
      text = await file.text()
    } catch {
      if (!cancelled) uploadError.value = 'Could not read this CSV. Please choose it again.'
      return
    }
    if (cancelled) return
    const rows = parseCsv(text)
    const validation = validateBidRows(rows)
    missingColumns.value = validation.missingColumns
    parseErrors.value = validation.errors
    if (!validation.missingColumns.length && !validation.errors.length) {
      parsedRows.value = rows
    }
  })

  // One row per day. With nothing saved yet the row is the upload box; once bids
  // are saved it's a summary that opens (>) to show the uploaded file as a table,
  // with the upload box tucked away behind ↻ (replace).
  const replacing = ref(false)
  const showUpload = computed(() => !props.savedCount || replacing.value)
  const open = ref(false)

  function startReplace() {
    replacing.value = true
    open.value = false
  }

  function cancelReplace() {
    replacing.value = false
    bidFile.value = null
  }

  // The file as it was uploaded, so staff can check it's the right form. Files
  // uploaded before they were kept come back as null.
  const savedFile = ref<BidFileRead | null>(null)
  async function loadSavedFile() {
    savedFile.value = null
    if (!props.semesterId || !props.savedCount) return
    savedFile.value = await $fetch<BidFileRead | null>('/api/team-formation/bid-file', {
      query: { semesterId: props.semesterId, meetingDay: props.meetingDay },
    }).catch(() => null)
  }
  watch(() => [props.semesterId, props.savedCount], loadSavedFile, { immediate: true })

  // Columns are keyed by position: header names can contain dots, which the table
  // would otherwise read as nested paths.
  const fileColumns = computed<TableColumn<Record<string, string>>[]>(() =>
    (savedFile.value?.columns ?? []).map((name, i) => ({
      id: `col${i}`,
      header: name || '(no header)',
      accessorFn: (row) => row[name] ?? '',
    }))
  )

  const canUpload = computed(
    () =>
      !!props.semesterId &&
      parsedRows.value.length > 0 &&
      !parseErrors.value.length &&
      !missingColumns.value.length
  )

  async function submitBidFile() {
    if (!canUpload.value || uploading.value || !props.semesterId) return
    uploading.value = true
    uploadError.value = null
    try {
      uploadResult.value = await $fetch('/api/team-formation/bids', {
        method: 'POST',
        query: {
          semesterId: props.semesterId,
          meetingDay: props.meetingDay,
          fileName: bidFile.value?.name,
        },
        body: parsedRows.value,
      })
      // Require a fresh selection before importing this roster again.
      bidFile.value = null
      replacing.value = false
      emit('imported')
      await loadSavedFile()
    } catch (e: any) {
      uploadError.value = e?.data?.message ?? e?.message ?? 'Failed to import bid file.'
    } finally {
      uploading.value = false
    }
  }
</script>

<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-800">
    <div class="flex items-center gap-2 p-3">
      <UButton
        v-if="savedCount && !replacing"
        :icon="open ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="open ? 'Hide bid file' : 'Show bid file'"
        :aria-expanded="open"
        @click="open = !open"
      />
      <span v-else class="w-8 shrink-0" />
      <span class="w-24 shrink-0 font-medium">{{ titleCase(meetingDay) }}</span>

      <template v-if="!showUpload">
        <button
          type="button"
          class="min-w-0 flex-1 truncate text-left text-sm text-gray-600 dark:text-gray-300"
          @click="open = !open"
        >
          {{ savedFile ? savedFile.rows.length : savedCount }} student(s)
          <template v-if="savedFile">
            · {{ savedFile.fileName }} · uploaded
            {{ new Date(savedFile.uploadedAt).toLocaleDateString() }}
          </template>
        </button>
        <UButton
          icon="i-heroicons-arrow-path"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Replace bid file"
          title="Replace bid file"
          @click="startReplace"
        />
      </template>

      <UFileUpload
        v-else
        v-model="bidFile"
        accept=".csv"
        layout="list"
        icon="i-heroicons-arrow-up-tray"
        :label="`Drop the ${titleCase(meetingDay)} bid file here or click to browse`"
        :disabled="!semesterId || uploading"
        class="min-w-0 flex-1"
        :ui="{ base: 'min-h-0 border-dashed py-3', label: 'mt-1 text-sm' }"
      />
    </div>

    <div
      v-if="open && !showUpload"
      class="border-t border-gray-200 bg-gray-200/70 p-4 dark:border-gray-800 dark:bg-gray-950"
    >
      <!-- The file shows as a sheet raised off a tray (white in light mode, a lighter
           grey in dark mode), so it reads as the uploaded document, not part of the app. -->
      <div
        v-if="savedFile"
        class="bid-paper overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-gray-300 dark:bg-gray-800 dark:ring-gray-700"
      >
        <div class="flex items-center gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
          <UIcon name="i-heroicons-document-text" class="size-5 shrink-0 text-gray-400" />
          <span class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ savedFile.fileName }}</span>
          <span class="ms-auto shrink-0 text-xs text-gray-500">
            {{ savedFile.rows.length }} rows · {{ savedFile.columns.length }} columns
          </span>
        </div>
        <UTable
          :data="savedFile.rows"
          :columns="fileColumns"
          sticky
          class="max-h-96"
          :ui="{ td: 'whitespace-nowrap py-2', th: 'whitespace-nowrap' }"
        />
      </div>
      <p v-else class="text-sm text-gray-500">
        This file was uploaded before the app saved bid files. Upload it again with ↻ to see it.
      </p>
    </div>

    <div
      v-if="showUpload && (replacing || !semesterId || bidFile || uploadError)"
      class="space-y-3 px-3 pb-3"
    >
      <div v-if="replacing" class="space-y-2">
        <UAlert
          color="warning"
          variant="subtle"
          title="Replacing the bid file"
          description="Students in the new file get their info and choices updated. Everyone else stays. Teams don't change until you regenerate."
        />
        <UButton label="Cancel" size="xs" color="neutral" variant="ghost" @click="cancelReplace" />
      </div>

      <p v-if="!semesterId" class="text-sm text-gray-500">Pick a semester first.</p>

      <UAlert
        v-if="missingColumns.length"
        color="error"
        variant="subtle"
        title="Missing required columns"
        :description="missingColumns.join(', ')"
      />

      <div v-else-if="parseErrors.length" class="space-y-2">
        <UAlert
          color="error"
          variant="subtle"
          :title="`${parseErrors.length} error(s). Nothing was uploaded.`"
        />
        <ul class="max-h-64 space-y-1 overflow-y-auto text-sm">
          <li v-for="(err, i) in parseErrors" :key="i" class="text-red-600 dark:text-red-400">
            Row {{ err.row }}: {{ err.message }}
          </li>
        </ul>
      </div>

      <UAlert
        v-else-if="parsedRows.length"
        color="success"
        variant="subtle"
        :title="`${parsedRows.length} row(s) look good`"
      />

      <UButton
        v-if="bidFile"
        :label="`Upload ${titleCase(meetingDay)} CSV`"
        icon="i-heroicons-arrow-up-tray"
        :loading="uploading"
        :disabled="!canUpload || uploading"
        @click="submitBidFile"
      />

      <UAlert
        v-if="uploadError"
        color="error"
        variant="subtle"
        title="Upload failed"
        :description="uploadError"
      />
    </div>

    <div v-if="uploadResult" class="space-y-2 px-3 pb-3">
      <UAlert
        color="success"
        variant="subtle"
        title="Uploaded"
        :description="`${uploadResult.studentsImported} student(s) imported, ${uploadResult.choicesCreated} choice(s) recorded.`"
      />
      <UAlert
        v-if="uploadResult.skippedStudents.length"
        color="warning"
        variant="subtle"
        title="Skipped rows (no SSO ID and no name)"
        :description="uploadResult.skippedStudents.join(', ')"
      />

      <div v-if="uploadResult.noBidPlacements.length" class="space-y-2">
        <UAlert
          color="info"
          variant="subtle"
          :title="`${uploadResult.noBidPlacements.length} student(s) had no bid, so they were placed by major`"
        />
        <ul class="space-y-1 text-sm">
          <li
            v-for="p in uploadResult.noBidPlacements"
            :key="p.netID"
            class="flex items-center justify-between rounded border border-gray-200 p-2 dark:border-gray-800"
          >
            <span
              >{{ p.name }} <span class="text-gray-500">({{ p.major }})</span></span
            >
            <span class="text-gray-500">→ {{ p.projectName }}</span>
          </li>
        </ul>
      </div>
      <UAlert
        v-if="uploadResult.noBidUnplaced.length"
        color="warning"
        variant="subtle"
        title="No-bid students weren't placed. There are no teams for this day yet."
        :description="uploadResult.noBidUnplaced.join(', ')"
      />
    </div>
  </div>
</template>



<style>
  /* Nuxt UI colors the table from these variables. In dark mode, match them to the
     gray-800 sheet so its header and row lines blend in (light mode needs nothing). */
  .dark .bid-paper {
    --ui-bg: var(--color-gray-800);
    --ui-bg-elevated: var(--color-gray-700);
    --ui-border: var(--color-gray-700);
    --ui-border-accented: var(--color-gray-600);
  }
</style>
