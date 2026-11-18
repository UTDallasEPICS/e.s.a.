<script setup lang="ts">
  import { ref, watch, onMounted } from 'vue'
  import Dashboard from '~/components/database-redesign/Dashboard.vue'
  import StudentsPage from '~/components/database-redesign/StudentsPage.vue'
  import ProjectsPage from '~/components/database-redesign/ProjectsPage.vue'
  import InsightsPage from '~/components/database-redesign/InsightsPage.vue'
  import ChatPage from '~/components/database-redesign/ChatPage.vue'
  import SettingsPage from '~/components/database-redesign/SettingsPage.vue'
  import PartnersPage from '~/components/database-redesign/PartnersPage.vue'
  import IntakePage from '~/components/database-redesign/IntakePage.vue'

  import type {
    ColorPalette,
    GraphDisplaySettings,
    PinnedItem,
    ThemePalettes,
  } from '~/components/types'

  import '~/components/database-redesign/figma-redesign.css'

  type Page =
    | 'dashboard'
    | 'students'
    | 'projects'
    | 'partners'
    | 'insights'
    | 'chat'
    | 'intake'
    | 'settings'
  const page = ref<Page>('dashboard')
  const theme = ref<'light' | 'dark'>('light')

  const defaultPalettes: ThemePalettes = {
    light: {
      background: '#f2f0eb',
      card: '#ffffff',
      foreground: '#1a1200',
      primary: '#1a3a1a',
      secondary: '#e8ede4',
      mutedForeground: '#5a6b52',
      accent: '#c45c1a',
      border: '#cdd8c5',
      navigationBackground: '#122612',
      navigationText: '#ffffff',
      navigationActive: '#c45c1a',
      chartText: '#1a3a1a',
      chartGrid: '#d5dfd0',
      classChart: '#0f766e',
      majorChart: '#c45c1a',
      genderChart: '#2d6a2d',
      genderChartSecondary: '#e47a35',
      raceChart: '#6366f1',
    },
    dark: {
      background: '#0f1710',
      card: '#18251a',
      foreground: '#edf4e9',
      primary: '#9fc49b',
      secondary: '#223225',
      mutedForeground: '#a9bca4',
      accent: '#e47a35',
      border: '#344a36',
      navigationBackground: '#09150b',
      navigationText: '#edf4e9',
      navigationActive: '#e47a35',
      chartText: '#f1f7ee',
      chartGrid: '#49624c',
      classChart: '#5eead4',
      majorChart: '#fb923c',
      genderChart: '#86efac',
      genderChartSecondary: '#fdba74',
      raceChart: '#a5b4fc',
    },
  }
  let savedPalettes: Partial<ThemePalettes> = {}
  const colorPalettes = ref<ThemePalettes>({
    light: { ...defaultPalettes.light },
    dark: { ...defaultPalettes.dark },
  })
  const defaultGraphDisplay: GraphDisplaySettings = {
    fontFamily: 'Inter',
    fontSize: 13,
    valueFontSize: 13,
    barThickness: 8,
    classChartHeight: 260,
    genderChartHeight: 270,
  }
  let savedGraphDisplay: Partial<GraphDisplaySettings> = {}
  const graphDisplay = ref<GraphDisplaySettings>({ ...defaultGraphDisplay, ...savedGraphDisplay })
  const selectedProjectId = ref<string | null>(null)
  const selectedProjectSemester = ref<string | null>(null)
  const selectedStudentId = ref<string | null>(null)
  const selectedInsightId = ref<string | null>(null)
  const pinnedItems = ref<PinnedItem[]>([])

  watch(
    pinnedItems,
    (items) => {
      if (import.meta.client) {
        localStorage.setItem('epics-pinned-items', JSON.stringify(items))
      }
    },
    { deep: true }
  )

  watch(
    graphDisplay,
    (value) => {
      if (import.meta.client) {
        localStorage.setItem('epics-graph-display', JSON.stringify(value))
      }
    },
    { deep: true }
  )

  watch(
    [theme, colorPalettes],
    ([activeTheme, palettes]) => {
      if (!import.meta.client) return

      document.documentElement.dataset.theme = activeTheme
      const palette = palettes[activeTheme]
      const root = document.documentElement.style
      root.setProperty('--background', palette.background)
      root.setProperty('--card', palette.card)
      root.setProperty('--foreground', palette.foreground)
      root.setProperty('--primary', palette.primary)
      root.setProperty('--secondary', palette.secondary)
      root.setProperty('--muted-foreground', palette.mutedForeground)
      root.setProperty('--accent', palette.accent)
      root.setProperty('--border', palette.border)
      root.setProperty('--navigation-background', palette.navigationBackground)
      root.setProperty('--navigation-text', palette.navigationText)
      root.setProperty('--navigation-active', palette.navigationActive)
      root.setProperty('--chart-text', palette.chartText)
      root.setProperty('--chart-grid', palette.chartGrid)
      root.setProperty('--class-chart', palette.classChart)
      root.setProperty('--major-chart', palette.majorChart)
      root.setProperty('--gender-chart', palette.genderChart)
      root.setProperty('--gender-chart-secondary', palette.genderChartSecondary)
      root.setProperty('--race-chart', palette.raceChart)
      localStorage.setItem('epics-theme', activeTheme)
      localStorage.setItem('epics-color-palettes', JSON.stringify(palettes))
    },
    { deep: true }
  )

  function updateColor(key: keyof ColorPalette, value: string) {
    colorPalettes.value[theme.value][key] = value
  }

  function resetCurrentPalette() {
    colorPalettes.value[theme.value] = { ...defaultPalettes[theme.value] }
  }

  function updateGraphSetting<K extends keyof GraphDisplaySettings>(
    key: K,
    value: GraphDisplaySettings[K]
  ) {
    graphDisplay.value[key] = value
  }

  function resetGraphDisplay() {
    graphDisplay.value = { ...defaultGraphDisplay }
  }

  function togglePin(item: PinnedItem) {
    const index = pinnedItems.value.findIndex((pin) => pin.key === item.key)
    if (index >= 0) pinnedItems.value.splice(index, 1)
    else pinnedItems.value.push(item)
  }

  function goToPage(nextPage: string) {
    page.value = nextPage as Page
    if (nextPage === 'projects') {
      selectedProjectId.value = null
      selectedProjectSemester.value = null
    }
    if (nextPage === 'students') selectedStudentId.value = null
    if (nextPage === 'insights') selectedInsightId.value = null
  }

  function openProject(projectId: string, semesterId?: string) {
    selectedProjectId.value = projectId
    selectedProjectSemester.value = semesterId ?? null
    page.value = 'projects'
  }

  function openStudent(studentId: string) {
    selectedStudentId.value = studentId
    page.value = 'students'
  }

  function openInsight(insightId: string) {
    selectedInsightId.value = insightId
    page.value = 'insights'
  }

  const NAV: { id: Page; label: string; marker: string }[] = [
    { id: 'dashboard', label: 'Dashboard', marker: 'D' },
    { id: 'students', label: 'Students', marker: 'S' },
    { id: 'projects', label: 'Projects', marker: 'P' },
    { id: 'insights', label: 'Insights', marker: 'I' },
    { id: 'settings', label: 'Settings', marker: 'ST' },
  ]
  onMounted(() => {
    const savedTheme = localStorage.getItem('epics-theme')

    if (savedTheme === 'light' || savedTheme === 'dark') {
      theme.value = savedTheme
    } else {
      theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    colorPalettes.value = {
      light: { ...defaultPalettes.light },
      dark: { ...defaultPalettes.dark },
    }

    try {
      const savedGraphs = JSON.parse(
        localStorage.getItem('epics-graph-display') ?? '{}'
      ) as Partial<GraphDisplaySettings>

      graphDisplay.value = { ...defaultGraphDisplay, ...savedGraphs }
    } catch {
      graphDisplay.value = { ...defaultGraphDisplay }
    }

    try {
      pinnedItems.value = (
        JSON.parse(localStorage.getItem('epics-pinned-items') ?? '[]') as PinnedItem[]
      ).filter((item) => item.type === 'project' || item.type === 'insight')
    } catch {
      pinnedItems.value = []
    }
  })
</script>

<template>
  <div style="display: flex; min-height: 100vh">
    <nav class="sidebar">
      <div style="padding: 22px 18px 16px">
        <div
          class="font-display brand-text"
          style="font-size: 15px; font-weight: 700; color: #fff; letter-spacing: -0.01em"
        >
          EPICS
        </div>
        <div
          class="nav-label"
          style="
            font-size: 10.5px;
            color: rgba(255, 255, 255, 0.4);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-top: 2px;
          "
        >
          Program Tracker
        </div>
      </div>
      <div style="flex: 1">
        <div
          v-for="item in NAV"
          :key="item.id"
          class="nav-item"
          :class="{ active: page === item.id }"
          @click="goToPage(item.id)"
        >
          <span class="nav-marker">{{ item.marker }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </div>
      </div>
      <div style="padding: 16px 18px; border-top: 1px solid rgba(255, 255, 255, 0.08)">
        <button
          class="theme-toggle"
          :aria-label="`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`"
          @click="theme = theme === 'light' ? 'dark' : 'light'"
        >
          <span class="theme-toggle-track" :class="{ dark: theme === 'dark' }">
            <span class="theme-toggle-thumb" />
          </span>
          <span class="nav-label">{{ theme === 'light' ? 'Light mode' : 'Dark mode' }}</span>
        </button>
        <div class="nav-label" style="font-size: 11px; color: rgba(255, 255, 255, 0.35)">
          Andrea's Dashboard
        </div>
        <div class="nav-label" style="font-size: 10.5px; color: rgba(255, 255, 255, 0.2)">
          Program coordination workspace
        </div>
      </div>
    </nav>

    <main class="main-content" style="flex: 1">
      <Dashboard
        v-if="page === 'dashboard'"
        @navigate="goToPage"
        @open-project="openProject"
        @open-student="openStudent"
        @open-insight="openInsight"
        :pinned-items="pinnedItems"
        @toggle-pin="togglePin"
      />
      <StudentsPage
        v-else-if="page === 'students'"
        :initial-student-id="selectedStudentId"
        @open-project="openProject"
      />
      <ProjectsPage
        v-else-if="page === 'projects'"
        :initial-project-id="selectedProjectId"
        :initial-semester-id="selectedProjectSemester"
        :pinned-items="pinnedItems"
        @open-student="openStudent"
        @toggle-pin="togglePin"
      />
      <InsightsPage
        v-else-if="page === 'insights'"
        :pinned-items="pinnedItems"
        :initial-insight-id="selectedInsightId"
        :theme="theme"
        :palette="colorPalettes[theme]"
        :graph-display="graphDisplay"
        @update-color="updateColor"
        @update-graph-setting="updateGraphSetting"
        @toggle-pin="togglePin"
      />
      <ChatPage v-else-if="page === 'chat'" />
      <PartnersPage v-else-if="page === 'partners'" />
      <IntakePage v-else-if="page === 'intake'" />
      <SettingsPage
        v-else-if="page === 'settings'"
        :theme="theme"
        :palette="colorPalettes[theme]"
        :graph-display="graphDisplay"
        @set-theme="theme = $event"
        @update-color="updateColor"
        @update-graph-setting="updateGraphSetting"
        @reset-graphs="resetGraphDisplay"
        @reset="resetCurrentPalette"
      />
    </main>
  </div>
</template>
