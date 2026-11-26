<script setup lang="ts">
  /**
   * Purpose
   * Render the database redesign part of the ESA interface.
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
  import { ref, watch, onMounted } from 'vue'
  import { students, projects, partners, semesters } from '~/components/data'
  import Dashboard from '~/components/database-redesign/Dashboard.vue'
  import StudentsPage from '~/components/database-redesign/StudentsPage.vue'
  import ProjectsPage from '~/components/database-redesign/ProjectsPage.vue'
  import InsightsPage from '~/components/database-redesign/InsightsPage.vue'
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

  type Page = 'dashboard' | 'students' | 'projects' | 'partners' | 'insights' | 'intake' | 'settings'
  // Store page as state so Vue reacts when it changes.
  const page = ref<Page>('dashboard')
  // Store theme as state so Vue reacts when it changes.
  const theme = ref<'light' | 'dark'>('light')

  // Define defaultPalettes for the steps below.
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
  // Define savedPalettes for the steps below.
  let savedPalettes: Partial<ThemePalettes> = {}
  // Store colorPalettes as state so Vue reacts when it changes.
  const colorPalettes = ref<ThemePalettes>({
    light: { ...defaultPalettes.light },
    dark: { ...defaultPalettes.dark },
  })
  // Define defaultGraphDisplay for the steps below.
  const defaultGraphDisplay: GraphDisplaySettings = {
    fontFamily: 'Inter',
    fontSize: 13,
    valueFontSize: 13,
    barThickness: 8,
    classChartHeight: 260,
    genderChartHeight: 270,
  }
  // Define savedGraphDisplay for the steps below.
  let savedGraphDisplay: Partial<GraphDisplaySettings> = {}
  // Store graphDisplay as state so Vue reacts when it changes.
  const graphDisplay = ref<GraphDisplaySettings>({ ...defaultGraphDisplay, ...savedGraphDisplay })
  // Store selectedProjectId as state so Vue reacts when it changes.
  const selectedProjectId = ref<string | null>(null)
  // Store selectedProjectSemester as state so Vue reacts when it changes.
  const selectedProjectSemester = ref<string | null>(null)
  // Store selectedStudentId as state so Vue reacts when it changes.
  const selectedStudentId = ref<string | null>(null)
  // Store selectedPartnerId as state so Vue reacts when it changes.
  const selectedPartnerId = ref<string | null>(null)
  // Use useState to initialize contentSemester.
  const contentSemester = useState<string>('epics-selected-semester', () => 'FA26')
  // Store selectedInsightId as state so Vue reacts when it changes.
  const selectedInsightId = ref<string | null>(null)
  // Store pinnedItems as state so Vue reacts when it changes.
  const pinnedItems = ref<PinnedItem[]>([])

  // Run the callback when the watched values change.
  watch(
    pinnedItems,
    (items) => {
      // Check whether import.meta.client before running this branch.
      if (import.meta.client) {
        // Call localStorage.setItem to run this step.
        localStorage.setItem('epics-pinned-items', JSON.stringify(items))
      }
    },
    { deep: true }
  )

  // Run the callback when the watched values change.
  watch(
    graphDisplay,
    (value) => {
      // Check whether import.meta.client before running this branch.
      if (import.meta.client) {
        // Call localStorage.setItem to run this step.
        localStorage.setItem('epics-graph-display', JSON.stringify(value))
      }
    },
    { deep: true }
  )

  // Run the callback when the watched values change.
  watch(
    [theme, colorPalettes],
    ([activeTheme, palettes]) => {
      // Check whether !import.meta.client before running this branch.
      if (!import.meta.client) return

      // Update document.documentElement.dataset.theme with the value on the right.
      document.documentElement.dataset.theme = activeTheme
      // Define palette for the steps below.
      const palette = palettes[activeTheme]
      // Define root for the steps below.
      const root = document.documentElement.style
      // Call root.setProperty to run this step.
      root.setProperty('--background', palette.background)
      // Call root.setProperty to run this step.
      root.setProperty('--card', palette.card)
      // Call root.setProperty to run this step.
      root.setProperty('--foreground', palette.foreground)
      // Call root.setProperty to run this step.
      root.setProperty('--primary', palette.primary)
      // Call root.setProperty to run this step.
      root.setProperty('--secondary', palette.secondary)
      // Call root.setProperty to run this step.
      root.setProperty('--muted-foreground', palette.mutedForeground)
      // Call root.setProperty to run this step.
      root.setProperty('--accent', palette.accent)
      // Call root.setProperty to run this step.
      root.setProperty('--border', palette.border)
      // Call root.setProperty to run this step.
      root.setProperty('--navigation-background', palette.navigationBackground)
      // Call root.setProperty to run this step.
      root.setProperty('--navigation-text', palette.navigationText)
      // Call root.setProperty to run this step.
      root.setProperty('--navigation-active', palette.navigationActive)
      // Call root.setProperty to run this step.
      root.setProperty('--chart-text', palette.chartText)
      // Call root.setProperty to run this step.
      root.setProperty('--chart-grid', palette.chartGrid)
      // Call root.setProperty to run this step.
      root.setProperty('--class-chart', palette.classChart)
      // Call root.setProperty to run this step.
      root.setProperty('--major-chart', palette.majorChart)
      // Call root.setProperty to run this step.
      root.setProperty('--gender-chart', palette.genderChart)
      // Call root.setProperty to run this step.
      root.setProperty('--gender-chart-secondary', palette.genderChartSecondary)
      // Call root.setProperty to run this step.
      root.setProperty('--race-chart', palette.raceChart)
      // Call localStorage.setItem to run this step.
      localStorage.setItem('epics-theme', activeTheme)
      // Call localStorage.setItem to run this step.
      localStorage.setItem('epics-color-palettes', JSON.stringify(palettes))
    },
    { deep: true }
  )

  // Define the helper that will update color.
  function updateColor(key: keyof ColorPalette, value: string) {
    // Update colorPalettes.value[theme.value][key] with the value on the right.
    colorPalettes.value[theme.value][key] = value
  }

  // Define the helper that will reset current palette.
  function resetCurrentPalette() {
    // Update colorPalettes.value[theme.value] with the value on the right.
    colorPalettes.value[theme.value] = { ...defaultPalettes[theme.value] }
  }

  // Define the helper that will update graph setting.
  function updateGraphSetting<K extends keyof GraphDisplaySettings>(
    key: K,
    value: GraphDisplaySettings[K]
  ) {
    // Update graphDisplay.value[key] with the value on the right.
    graphDisplay.value[key] = value
  }

  // Define the helper that will reset graph display.
  function resetGraphDisplay() {
    // Update graphDisplay.value with the value on the right.
    graphDisplay.value = { ...defaultGraphDisplay }
  }

  // Define the helper that will toggle pin.
  function togglePin(item: PinnedItem) {
    // Use pinnedItems.value.findIndex to initialize index.
    const index = pinnedItems.value.findIndex((pin) => pin.key === item.key)
    // Check whether index >= 0 before running this branch.
    if (index >= 0) pinnedItems.value.splice(index, 1)
    else pinnedItems.value.push(item)
  }

  // Define the helper that will go to page.
  function goToPage(nextPage: string) {
    // Update page.value with the value on the right.
    page.value = nextPage as Page
    // Check whether nextPage === 'projects' before running this branch.
    if (nextPage === 'projects') {
      // Update selectedProjectId.value with the value on the right.
      selectedProjectId.value = null
      // Update selectedProjectSemester.value with the value on the right.
      selectedProjectSemester.value = null
    }
    // Check whether nextPage === 'students' before running this branch.
    if (nextPage === 'students') selectedStudentId.value = null
    // Check whether nextPage === 'insights' before running this branch.
    if (nextPage === 'insights') selectedInsightId.value = null
  }

  // Define the helper that will open project.
  function openProject(projectId: string, semesterId?: string) {
    // Update selectedProjectId.value with the value on the right.
    selectedProjectId.value = projectId
    // Update selectedProjectSemester.value with the value on the right.
    selectedProjectSemester.value = semesterId ?? null
    // Update page.value with the value on the right.
    page.value = 'projects'
  }

  // Define the helper that will open student.
  function openStudent(studentId: string, semesterId?: string) {
    // Use students.find to initialize student.
    const student = students.find((record) => record.id === studentId)
    // Check whether semesterId before running this branch.
    if (semesterId) contentSemester.value = semesterId
    else if (student && !student.semesters.includes(contentSemester.value))
      // Update contentSemester.value with the value on the right.
      contentSemester.value = 'all'
    // Update selectedStudentId.value with the value on the right.
    selectedStudentId.value = studentId
    // Update page.value with the value on the right.
    page.value = 'students'
  }

  // Define the helper that will open insight.
  function openInsight(insightId: string) {
    // Update selectedInsightId.value with the value on the right.
    selectedInsightId.value = insightId
    // Update page.value with the value on the right.
    page.value = 'insights'
  }

  // Define NAV for the steps below.
  const NAV: { id: Page; label: string; marker: string }[] = [
    { id: 'dashboard', label: 'Dashboard', marker: 'D' },
    { id: 'students', label: 'Students', marker: 'S' },
    { id: 'projects', label: 'Projects', marker: 'P' },
    { id: 'insights', label: 'Insights', marker: 'I' },
    { id: 'settings', label: 'Settings', marker: 'ST' },
  ]
  // Call onMounted to run this step.
  onMounted(() => {
    // Define query for the steps below.
    const query = new URLSearchParams(window.location.search)
    // Use query.get to initialize semesterId.
    const semesterId = query.get('semester')
    // Check whether semesterId && semesters.some((s) => s.id === semesterId) before running this branch.
    if (semesterId && semesters.some((s) => s.id === semesterId)) contentSemester.value = semesterId
    // Use query.get to initialize studentId.
    const studentId = query.get('student')
    // Use query.get to initialize projectId.
    const projectId = query.get('project')
    // Use query.get to initialize partnerId.
    const partnerId = query.get('partner')
    // Check whether studentId && students.some((s) => s.id === studentId) before running this branch.
    if (studentId && students.some((s) => s.id === studentId)) openStudent(studentId)
    else if (projectId && projects.some((p) => p.id === projectId))
      // Call openProject to run this step.
      openProject(projectId, semesterId ?? undefined)
    else if (partnerId && partners.some((p) => p.id === partnerId)) {
      // Update selectedPartnerId.value with the value on the right.
      selectedPartnerId.value = partnerId
      // Update page.value with the value on the right.
      page.value = 'partners'
    }

    // Use localStorage.getItem to initialize savedTheme.
    const savedTheme = localStorage.getItem('epics-theme')

    // Check whether savedTheme === 'light' || savedTheme === 'dark' before running this branch.
    if (savedTheme === 'light' || savedTheme === 'dark') {
      // Update theme.value with the value on the right.
      theme.value = savedTheme
    } else {
      // Update theme.value with the value on the right.
      theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    // Update colorPalettes.value with the value on the right.
    colorPalettes.value = {
      light: { ...defaultPalettes.light },
      dark: { ...defaultPalettes.dark },
    }

    try {
      // Define savedGraphs for the steps below.
      const savedGraphs = JSON.parse(
        localStorage.getItem('epics-graph-display') ?? '{}'
      ) as Partial<GraphDisplaySettings>

      // Update graphDisplay.value with the value on the right.
      graphDisplay.value = { ...defaultGraphDisplay, ...savedGraphs }
    } catch {
      // Update graphDisplay.value with the value on the right.
      graphDisplay.value = { ...defaultGraphDisplay }
    }

    try {
      // Update pinnedItems.value with the value on the right.
      pinnedItems.value = (
        JSON.parse(localStorage.getItem('epics-pinned-items') ?? '[]') as PinnedItem[]
      ).filter(
        (item) =>
          item.type === 'project' ||
          item.type === 'insight' ||
          (item.type === 'ai' && item.snapshot?.result)
      )
    } catch {
      // Update pinnedItems.value with the value on the right.
      pinnedItems.value = []
    }
  })
  // These settings control the page text. Each chart keeps its own font.
  const typography = ref<Partial<{
    title: string; heading: string; body: string
    titleSize: number; headingSize: number; bodySize: number
  }>>({})
  const typographyKey = 'esa-app-typography'

  onMounted(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(typographyKey) ?? '{}')
      for (const role of ['title', 'heading', 'body'] as const) {
        if (typeof saved?.[role] === 'string' && saved[role].length < 80) typography.value[role] = saved[role]
      }
      for (const [key, min, max] of [['titleSize', 18, 42], ['headingSize', 12, 30], ['bodySize', 11, 22]] as const) {
        const size = saved?.[key]
        if (Number.isInteger(size) && size >= min && size <= max) typography.value[key] = size
      }
    } catch {
      typography.value = {}
    }
  })

  watch(typography, (value) => {
    localStorage.setItem(typographyKey, JSON.stringify(value))
  }, { deep: true })

  function fontValue(font?: string) {
    return font ? JSON.stringify(font) : undefined
  }
</script>

<template>
  <div class="esa-redesign"
    :class="{ 'custom-title-size': typography.titleSize, 'custom-heading-size': typography.headingSize, 'custom-body-size': typography.bodySize }"
    style="display: flex; min-height: 100vh"
    :style="{ '--esa-title-font': fontValue(typography.title), '--esa-heading-font': fontValue(typography.heading), '--esa-body-font': fontValue(typography.body),
      '--esa-title-size': typography.titleSize ? typography.titleSize + 'px' : undefined,
      '--esa-heading-size': typography.headingSize ? typography.headingSize + 'px' : undefined,
      '--esa-body-size': typography.bodySize ? typography.bodySize + 'px' : undefined }">
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
      <div style="flex: 1; min-width: 0">
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
          <span class="nav-label">{{ theme === 'light' ? 'Light Mode' : 'Dark Mode' }}</span>
        </button>
        <div class="nav-label" style="font-size: 11px; color: rgba(255, 255, 255, 0.35)">
          Andrea's Dashboard
        </div>
        <div class="nav-label" style="font-size: 10.5px; color: rgba(255, 255, 255, 0.2)">
          Program Coordination Workspace
        </div>
      </div>
    </nav>

    <main class="main-content" style="flex: 1; min-width: 0">
      <Dashboard v-if="page !== 'dashboard'" :assistant-only="true" :pinned-items="pinnedItems"
        @navigate="goToPage" @open-project="openProject" @open-student="openStudent" @open-insight="openInsight" @toggle-pin="togglePin" />
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
        @reset-graphs="resetGraphDisplay"
        @open-student="openStudent"
        @toggle-pin="togglePin"
      />
      <PartnersPage :initial-partner-id="selectedPartnerId" v-else-if="page === 'partners'" />
      <IntakePage v-else-if="page === 'intake'" />
      <SettingsPage
        v-else-if="page === 'settings'"
        :theme="theme"
        :typography="typography"
        @update-typography="typography = $event"
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
