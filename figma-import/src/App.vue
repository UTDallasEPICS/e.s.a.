<script setup lang="ts">
  import { ref } from 'vue'
  import Dashboard from './components/Dashboard.vue'
  import StudentsPage from './components/StudentsPage.vue'
  import ProjectsPage from './components/ProjectsPage.vue'
  import PartnersPage from './components/PartnersPage.vue'
  import InsightsPage from './components/InsightsPage.vue'
  import ChatPage from './components/ChatPage.vue'
  import IntakePage from './components/IntakePage.vue'

  type Page = 'dashboard' | 'students' | 'projects' | 'partners' | 'insights' | 'chat' | 'intake'

  const page = ref<Page>('dashboard')

  const NAV: { id: Page; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '⬛' },
    { id: 'students', label: 'Students', icon: '👤' },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'partners', label: 'Partners', icon: '🤝' },
    { id: 'insights', label: 'Insights', icon: '📊' },
    { id: 'chat', label: 'AI Assistant', icon: '💬' },
    { id: 'intake', label: 'Student Intake', icon: '📝' },
  ]
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
          @click="page = item.id"
        >
          <span style="font-size: 14px">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </div>
      </div>
      <div style="padding: 16px 18px; border-top: 1px solid rgba(255, 255, 255, 0.08)">
        <div class="nav-label" style="font-size: 11px; color: rgba(255, 255, 255, 0.35)">
          Andrea's Dashboard
        </div>
        <div class="nav-label" style="font-size: 10.5px; color: rgba(255, 255, 255, 0.2)">
          Fall 2025 · v1.0
        </div>
      </div>
    </nav>

    <main class="main-content" style="flex: 1">
      <Dashboard v-if="page === 'dashboard'" @navigate="page = $event" />
      <StudentsPage v-else-if="page === 'students'" />
      <ProjectsPage v-else-if="page === 'projects'" />
      <PartnersPage v-else-if="page === 'partners'" />
      <InsightsPage v-else-if="page === 'insights'" />
      <ChatPage v-else-if="page === 'chat'" />
      <IntakePage v-else-if="page === 'intake'" />
    </main>
  </div>
</template>
