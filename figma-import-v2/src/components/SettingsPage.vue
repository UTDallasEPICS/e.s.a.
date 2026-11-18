<script setup lang="ts">
  import { ref } from 'vue'
  import type { ColorPalette, GraphDisplaySettings } from '../types'
  import { getSemesterLabel } from '../data'
  import {
    recoveryItems,
    restoreItem,
    permanentlyDeleteItem,
    projectAssignmentRemovals,
  } from '../contentStore'

  const props = defineProps<{
    theme: 'light' | 'dark'
    palette: ColorPalette
    graphDisplay: GraphDisplaySettings
  }>()

  const emit = defineEmits<{
    setTheme: [theme: 'light' | 'dark']
    updateColor: [key: keyof ColorPalette, value: string]
    updateGraphSetting: [
      key: keyof GraphDisplaySettings,
      value: GraphDisplaySettings[keyof GraphDisplaySettings],
    ]
    reset: []
    resetGraphs: []
  }>()

  const colorOptions: { key: keyof ColorPalette; label: string; description: string }[] = [
    { key: 'primary', label: 'Primary color', description: 'Headings, controls, and key actions' },
    { key: 'accent', label: 'Accent color', description: 'Links, highlights, and active states' },
    { key: 'background', label: 'Page background', description: 'Main workspace background' },
    { key: 'card', label: 'Card background', description: 'Dashboard cards and table surfaces' },
    {
      key: 'secondary',
      label: 'Secondary surface',
      description: 'Table headers and subtle panels',
    },
    { key: 'foreground', label: 'Primary text', description: 'Main body and table text' },
    {
      key: 'mutedForeground',
      label: 'Secondary text',
      description: 'Descriptions and supporting labels',
    },
    { key: 'border', label: 'Border color', description: 'Cards, dividers, and form controls' },
    {
      key: 'navigationBackground',
      label: 'Navigation background',
      description: 'Sidebar behind Dashboard, Students, Projects, and other pages',
    },
    {
      key: 'navigationText',
      label: 'Navigation text',
      description: 'Page labels and EPICS branding in the sidebar',
    },
    {
      key: 'navigationActive',
      label: 'Active navigation color',
      description: 'Selected page indicator and navigation highlights',
    },
    {
      key: 'chartText',
      label: 'Graph text',
      description: 'Axis labels, values, and chart legends',
    },
    {
      key: 'chartGrid',
      label: 'Graph grid lines',
      description: 'Reference lines behind chart data',
    },
    {
      key: 'classChart',
      label: 'Class-standing graph',
      description: 'Bars in the class-standing chart',
    },
    {
      key: 'majorChart',
      label: 'Major-distribution graph',
      description: 'Bars in the major-distribution chart',
    },
    {
      key: 'genderChart',
      label: 'Gender graph · Primary',
      description: 'First segment in the gender chart',
    },
    {
      key: 'genderChartSecondary',
      label: 'Gender graph · Secondary',
      description: 'Second segment in the gender chart',
    },
    {
      key: 'raceChart',
      label: 'Race and ethnicity graph',
      description: 'Bars in the race and ethnicity chart',
    },
  ]
  const pendingRecovery = ref<{ key: string; action: 'restore' | 'delete' } | null>(null)

  function updateColor(event: Event, key: keyof ColorPalette) {
    emit('updateColor', key, (event.target as HTMLInputElement).value)
  }

  function confirmRecoveryAction() {
    if (!pendingRecovery.value) return
    if (pendingRecovery.value.action === 'restore') restoreItem(pendingRecovery.value.key)
    else permanentlyDeleteItem(pendingRecovery.value.key)
    pendingRecovery.value = null
  }

  function formatDeletedAt(value: string) {
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

    <section class="stat-card graph-display-settings">
      <div class="panel-heading">
        <div>
          <h2>Graph Typography & Size</h2>
          <p>These controls update all Insights graphs and are saved automatically.</p>
        </div>
        <button class="secondary-button" @click="emit('resetGraphs')">Reset Graphs</button>
      </div>
      <div class="graph-control-grid">
        <label>
          <span>Font Family</span>
          <select
            :value="graphDisplay.fontFamily"
            @change="
              emit(
                'updateGraphSetting',
                'fontFamily',
                ($event.target as HTMLSelectElement).value as GraphDisplaySettings['fontFamily']
              )
            "
          >
            <option value="Inter">Inter</option>
            <option value="Roboto Slab">Roboto Slab</option>
            <option value="JetBrains Mono">JetBrains Mono</option>
          </select>
        </label>
        <label>
          <span>Label Size · {{ graphDisplay.fontSize }}px</span>
          <input
            type="range"
            min="10"
            max="18"
            :value="graphDisplay.fontSize"
            @input="
              emit(
                'updateGraphSetting',
                'fontSize',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
        <label>
          <span>Value Size · {{ graphDisplay.valueFontSize }}px</span>
          <input
            type="range"
            min="10"
            max="20"
            :value="graphDisplay.valueFontSize"
            @input="
              emit(
                'updateGraphSetting',
                'valueFontSize',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
        <label>
          <span>Distribution Bar Thickness · {{ graphDisplay.barThickness }}px</span>
          <input
            type="range"
            min="5"
            max="16"
            :value="graphDisplay.barThickness"
            @input="
              emit(
                'updateGraphSetting',
                'barThickness',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
        <label>
          <span>Class Graph Height · {{ graphDisplay.classChartHeight }}px</span>
          <input
            type="range"
            min="220"
            max="420"
            step="10"
            :value="graphDisplay.classChartHeight"
            @input="
              emit(
                'updateGraphSetting',
                'classChartHeight',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
        <label>
          <span>Gender Graph Height · {{ graphDisplay.genderChartHeight }}px</span>
          <input
            type="range"
            min="220"
            max="420"
            step="10"
            :value="graphDisplay.genderChartHeight"
            @input="
              emit(
                'updateGraphSetting',
                'genderChartHeight',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
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
          <span>AI Assistant</span>
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
          <div class="preview-eyebrow">Spring 2026</div>
          <h2>EPICS Program Dashboard</h2>
          <p>Preview how your selected colors work together.</p>
          <div class="preview-metrics">
            <div><strong>151</strong><span>Students</span></div>
            <div><strong>29</strong><span>Projects</span></div>
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
