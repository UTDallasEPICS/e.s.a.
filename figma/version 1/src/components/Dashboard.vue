<script setup lang="ts">
  import { students, projects, partners, semesters, choices, getPartnerById } from '../data'
  import StatusBadge from './StatusBadge.vue'
  import { getSemesterLabel } from '../data'

  const emit = defineEmits<{ navigate: [page: string] }>()

  const activeSem = 'SP26'
  const activeSemStudents = students.filter((s) => s.semesters.includes(activeSem))
  const activeProjects = projects.filter((p) => p.status === 'Active')
  const mentors = students.filter((s) => s.isMentor)
  const firstChoicePct = Math.round(
    (choices.filter((c) => c.rank === 1).length / choices.length) * 100
  )

  const stats = [
    {
      label: 'Active Students',
      value: activeSemStudents.length,
      sub: 'this semester',
      color: '#c45c1a',
    },
    {
      label: 'Active Projects',
      value: activeProjects.length,
      sub: `${partners.length} partners`,
      color: '#2d6a2d',
    },
    { label: 'Mentors', value: mentors.length, sub: 'across program', color: '#10b981' },
    { label: 'Semesters Tracked', value: semesters.length, sub: '2024–2026', color: '#f59e0b' },
    {
      label: '1st Choice Rate',
      value: `${firstChoicePct}%`,
      sub: 'of assignments',
      color: '#ef4444',
    },
  ]
</script>

<template>
  <div style="padding: 28px 32px">
    <div style="margin-bottom: 24px">
      <h1
        class="font-display"
        style="font-size: 22px; font-weight: 700; color: #1a3a1a; margin-bottom: 4px"
      >
        EPICS Program Dashboard
      </h1>
      <span style="color: #5a6b52; font-size: 12.5px">Spring 2026 · Last updated Sep 21, 2026</span>
    </div>

    <!-- Stats row -->
    <div
      style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 28px"
    >
      <div v-for="stat in stats" :key="stat.label" class="stat-card">
        <div
          style="
            font-size: 26px;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
            margin-bottom: 4px;
          "
          :style="{ color: stat.color }"
        >
          {{ stat.value }}
        </div>
        <div style="font-weight: 600; font-size: 12.5px; color: #1a3a1a; margin-bottom: 2px">
          {{ stat.label }}
        </div>
        <div style="font-size: 11.5px; color: #5a6b52">{{ stat.sub }}</div>
      </div>
    </div>

    <!-- Two-column -->
    <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; margin-bottom: 18px">
      <div class="stat-card">
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
          "
        >
          <span class="font-display" style="font-weight: 700; font-size: 14px; color: #1a3a1a"
            >Active Projects</span
          >
          <button
            @click="emit('navigate', 'projects')"
            style="
              font-size: 11.5px;
              color: #c45c1a;
              background: none;
              border: none;
              cursor: pointer;
              font-weight: 600;
            "
          >
            View all →
          </button>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Partner</th>
              <th>Semesters</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pr in activeProjects.slice(0, 6)" :key="pr.id">
              <td style="font-weight: 500">{{ pr.name }}</td>
              <td style="color: #5a6b52">{{ getPartnerById(pr.partnerId)?.name }}</td>
              <td>
                <span class="mono" style="font-size: 11px; color: #5a6b52">{{
                  pr.semesters.length
                }}</span>
              </td>
              <td><StatusBadge :status="pr.status" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="stat-card">
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
          "
        >
          <span class="font-display" style="font-weight: 700; font-size: 14px; color: #1a3a1a"
            >Spring 2026 Students</span
          >
          <button
            @click="emit('navigate', 'students')"
            style="
              font-size: 11.5px;
              color: #c45c1a;
              background: none;
              border: none;
              cursor: pointer;
              font-weight: 600;
            "
          >
            View all →
          </button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px">
          <div
            v-for="s in activeSemStudents.slice(0, 8)"
            :key="s.id"
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 5px 0;
              border-bottom: 1px solid #cdd8c5;
            "
          >
            <div>
              <div style="font-weight: 500; font-size: 12.5px">{{ s.name }}</div>
              <div style="font-size: 11px; color: #5a6b52">{{ s.major }} · {{ s.year }}</div>
            </div>
            <span
              v-if="s.isMentor"
              class="badge"
              style="background: #fef3c7; color: #92400e; font-size: 10px"
              >Mentor</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
