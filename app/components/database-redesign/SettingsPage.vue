<script setup lang="ts">
  /**
   * Purpose
   * Render the settings page part of the ESA interface.
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
  import { ref, computed } from 'vue'
  import ChartFontLibrary from './ChartFontLibrary.vue'

  // Each text role has its own picker and matches an existing app default.
  const typographyRoles = [
    { key: 'title', label: 'Page Titles', defaultFont: 'Roboto Slab', defaultSize: 24, min: 18, max: 42 },
    { key: 'heading', label: 'Section Headings', defaultFont: 'Roboto Slab', defaultSize: 16, min: 12, max: 30 },
    { key: 'body', label: 'Body Text', defaultFont: 'Inter', defaultSize: 13, min: 11, max: 22 },
  ] as const
  type TextRole = typeof typographyRoles[number]['key']
  type Typography = Partial<Record<TextRole, string> & Record<`${TextRole}Size`, number>>

  import type { ColorPalette, GraphDisplaySettings } from '../types'
  import { getSemesterLabel, students, projects } from '../data'
  // Recalculate fallStudentCount when the values it reads change.
  const fallStudentCount = computed(
    () => students.filter((student) => student.semesters.includes('FA26')).length
  )
  // Recalculate fallProjectCount when the values it reads change.
  const fallProjectCount = computed(
    () => projects.filter((project) => project.semesters.includes('FA26')).length
  )
  import {
    recoveryItems,
    restoreItem,
    permanentlyDeleteItem,
    projectAssignmentRemovals,
  } from '../contentStore'

  // Use defineProps to initialize props.
  const props = defineProps<{
    theme: 'light' | 'dark'
    palette: ColorPalette
    graphDisplay: GraphDisplaySettings
    typography: Typography
  }>()

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{
    updateTypography: [value: Typography]
    setTheme: [theme: 'light' | 'dark']
    updateColor: [key: keyof ColorPalette, value: string]
    updateGraphSetting: [
      key: keyof GraphDisplaySettings,
      value: GraphDisplaySettings[keyof GraphDisplaySettings],
    ]
    reset: []
    resetGraphs: []
  }>()

  // Define colorOptions for the steps below.
  const colorOptions: { key: keyof ColorPalette; label: string; description: string }[] = [
    { key: 'primary', label: 'Primary Color', description: 'Headings, Controls, and Key Actions' },
    { key: 'accent', label: 'Accent Color', description: 'Links, Highlights, and Active States' },
    { key: 'background', label: 'Page Background', description: 'Main Workspace Background' },
    { key: 'card', label: 'Card Background', description: 'Dashboard Cards and Table Surfaces' },
    {
      key: 'secondary',
      label: 'Secondary Surface',
      description: 'Table Headers and Subtle Panels',
    },
    { key: 'foreground', label: 'Primary Text', description: 'Main Body and Table Text' },
    {
      key: 'mutedForeground',
      label: 'Secondary Text',
      description: 'Descriptions and Supporting Labels',
    },
    { key: 'border', label: 'Border Color', description: 'Cards, Dividers, and Form Controls' },
    {
      key: 'navigationBackground',
      label: 'Navigation Background',
      description: 'Sidebar Behind Dashboard, Students, Projects, and Other Pages',
    },
    {
      key: 'navigationText',
      label: 'Navigation Text',
      description: 'Page Labels and EPICS Branding in the Sidebar',
    },
    {
      key: 'navigationActive',
      label: 'Active Navigation Color',
      description: 'Selected Page Indicator and Navigation Highlights',
    },
  ]
  // Store pendingRecovery as state so Vue reacts when it changes.
  const pendingRecovery = ref<{ key: string; action: 'restore' | 'delete' } | null>(null)

  // Define the helper that will update color.
  function updateColor(event: Event, key: keyof ColorPalette) {
    // Call emit to run this step.
    emit('updateColor', key, (event.target as HTMLInputElement).value)
  }

  // Define the helper that will confirm recovery action.
  function confirmRecoveryAction() {
    // Check whether !pendingRecovery.value before running this branch.
    if (!pendingRecovery.value) return
    // Check whether pendingRecovery.value.action === 'restore' before running this branch.
    if (pendingRecovery.value.action === 'restore') restoreItem(pendingRecovery.value.key)
    else permanentlyDeleteItem(pendingRecovery.value.key)
    // Update pendingRecovery.value with the value on the right.
    pendingRecovery.value = null
  }

  // Define the helper that will format deleted at.
  function formatDeletedAt(value: string) {
    // Pass new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format( new Date(val back to the caller.
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value)
    )
  }
</script>

<template>
  <div class="page-shell settings-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Appearance Settings</h1>
        <p class="page-subtitle">Personalize the dashboard colors for light and dark mode.</p>
      </div>
      <button class="secondary-button" @click="emit('reset')">Reset {{ theme }} colors</button>
    </div>

    <section class="stat-card settings-mode-card">
      <div>
        <div class="settings-label">Color mode to customize</div>
        <p>Each mode keeps its own color choices.</p>
      </div>
      <div class="mode-switcher">
        <button :class="{ active: theme === 'light' }" @click="emit('setTheme', 'light')">
          Light
        </button>
        <button :class="{ active: theme === 'dark' }" @click="emit('setTheme', 'dark')">
          Dark
        </button>
      </div>
    </section>



    <section class="stat-card typography-settings" aria-labelledby="typography-heading">
      <div class="panel-heading">
        <div>
          <h2 id="typography-heading">Typography</h2>
          <p>Choose fonts for app text. Chart fonts are set in Insights.</p>
        </div>
        <button type="button" class="secondary-button" @click="emit('updateTypography', {})">
          Reset Typography
        </button>
      </div>
      <div class="typography-choices">
        <fieldset v-for="role in typographyRoles" :key="role.key">
          <legend>{{ role.label }}</legend>
          <div class="typography-role-controls">
          <ChartFontLibrary
            :model-value="typography[role.key] ?? role.defaultFont"
            @update:model-value="emit('updateTypography', { ...typography, [role.key]: $event })"
          />
            <label class="typography-size">
              {{ role.label }} Size · {{ typography[`${role.key}Size`] ?? role.defaultSize }} px
              <input
                type="range"
                :min="role.min"
                :max="role.max"
                :value="typography[`${role.key}Size`] ?? role.defaultSize"
                @input="emit('updateTypography', { ...typography, [`${role.key}Size`]: Number(($event.target as HTMLInputElement).value) })"
              />
            </label>
          </div>
        </fieldset>
      </div>
    </section>

    <section class="stat-card recovery-section">
      <div class="panel-heading">
        <div>
          <h2>Recovery</h2>
          <p>
            Removed students and projects stay here until they are restored or permanently deleted.
          </p>
        </div>
        <span class="pin-count">{{ recoveryItems.length }} items</span>
      </div>
      <div v-if="recoveryItems.length" class="recovery-list">
        <div v-for="item in recoveryItems" :key="item.key" class="recovery-row">
          <div>
            <span class="pinned-type">{{ item.type }}</span>
            <div class="strong-cell">{{ item.record.name }}</div>
            <div class="muted-cell">Removed {{ formatDeletedAt(item.deletedAt) }}</div>
          </div>
          <div v-if="pendingRecovery?.key === item.key" class="recovery-confirmation">
            <span>
              Confirm {{ pendingRecovery.action === 'restore' ? 'restore' : 'permanent deletion' }}?
            </span>
            <button
              :class="pendingRecovery.action === 'restore' ? 'confirm-button' : 'danger-button'"
              @click="confirmRecoveryAction"
            >
              Confirm
            </button>
            <button class="cancel-button" @click="pendingRecovery = null">Cancel</button>
          </div>
          <div v-else class="confirm-actions">
            <button
              class="secondary-button"
              @click="pendingRecovery = { key: item.key, action: 'restore' }"
            >
              Restore
            </button>
            <button
              class="remove-button"
              @click="pendingRecovery = { key: item.key, action: 'delete' }"
            >
              Delete Forever
            </button>
          </div>
        </div>
      </div>
      <div v-else class="pinned-empty">No removed records are waiting for recovery.</div>
    </section>

    <section class="stat-card recovery-section">
      <div class="panel-heading">
        <div>
          <h2>Project Assignment History</h2>
          <p>
            Students removed from projects remain documented here without deleting their program
            record.
          </p>
        </div>
        <span class="pin-count">{{ projectAssignmentRemovals.length }} changes</span>
      </div>
      <div v-if="projectAssignmentRemovals.length" class="recovery-list">
        <div
          v-for="change in projectAssignmentRemovals.slice(0, 20)"
          :key="change.id"
          class="recovery-row"
        >
          <div>
            <span class="pinned-type">Removed from project</span>
            <div class="strong-cell">{{ change.studentName }} · {{ change.projectName }}</div>
            <div class="muted-cell">
              {{ getSemesterLabel(change.semesterId) }} · {{ formatDeletedAt(change.removedAt) }}
            </div>
            <div v-if="change.note" class="student-status-note">{{ change.note }}</div>
          </div>
        </div>
      </div>
      <div v-else class="pinned-empty">No project assignment changes have been recorded.</div>
    </section>

    <div class="settings-layout">
      <section class="stat-card color-settings-card">
        <div class="settings-section-heading">
          <h2>{{ theme === 'light' ? 'Light mode' : 'Dark mode' }} palette</h2>
          <p>Select any swatch to open the color picker.</p>
        </div>
        <div class="color-option-list">
          <label v-for="option in colorOptions" :key="option.key" class="color-option">
            <span class="color-option-copy">
              <strong>{{ option.label }}</strong>
              <span>{{ option.description }}</span>
            </span>
            <span class="color-picker-wrap">
              <input
                type="color"
                :value="props.palette[option.key]"
                :aria-label="`Choose ${option.label.toLowerCase()}`"
                @input="updateColor($event, option.key)"
              />
              <span class="mono">{{ props.palette[option.key].toUpperCase() }}</span>
            </span>
          </label>
        </div>
      </section>

      <section
        class="settings-preview"
        :style="{
          '--preview-background': palette.background,
          '--preview-card': palette.card,
          '--preview-foreground': palette.foreground,
          '--preview-primary': palette.primary,
          '--preview-secondary': palette.secondary,
          '--preview-muted': palette.mutedForeground,
          '--preview-accent': palette.accent,
          '--preview-border': palette.border,
          '--preview-navigation-background': palette.navigationBackground,
          '--preview-navigation-text': palette.navigationText,
          '--preview-navigation-active': palette.navigationActive,
          '--preview-chart-text': palette.chartText,
          '--preview-chart-grid': palette.chartGrid,
          '--preview-class-chart': palette.classChart,
          '--preview-major-chart': palette.majorChart,
          '--preview-gender-chart': palette.genderChart,
          '--preview-gender-chart-secondary': palette.genderChartSecondary,
          '--preview-race-chart': palette.raceChart,
        }"
      >
        <div class="settings-label">Live palette preview</div>
        <div class="preview-navigation">
          <strong>EPICS</strong>
          <span class="active">Dashboard</span>
          <span>Students</span>
          <span>Projects</span>
          <span>Insights</span>
          <span>Settings</span>
        </div>
        <div class="preview-graphs">
          <div><span>Class</span><i class="preview-bar class-bar" /></div>
          <div><span>Major</span><i class="preview-bar major-bar" /></div>
          <div>
            <span>Gender</span><i class="preview-bar gender-bar" /><i
              class="preview-bar gender-secondary-bar"
            />
          </div>
          <div><span>Race</span><i class="preview-bar race-bar" /></div>
        </div>
        <div class="preview-card">
          <div class="preview-eyebrow">Fall 2026</div>
          <h2>EPICS Program Dashboard</h2>
          <p>Preview how your selected colors work together.</p>
          <div class="preview-metrics">
            <div><strong>{{ fallStudentCount }}</strong><span>Students</span></div>
            <div><strong>{{ fallProjectCount }}</strong><span>Projects</span></div>
          </div>
          <div class="preview-row">
            <span>Inventory Tracking</span>
            <span class="preview-badge">In Progress</span>
          </div>
          <button>Primary action</button>
        </div>
      </section>
    </div>
  </div>
</template>
