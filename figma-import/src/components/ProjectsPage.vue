<script setup lang="ts">
  import { ref, computed } from 'vue'
  import {
    projects,
    partners,
    students,
    semesters,
    getPartnerById,
    getSemesterLabel,
  } from '../data'
  import StatusBadge from './StatusBadge.vue'

  const semFilter = ref('all')
  const statusFilter = ref('all')
  const partnerFilter = ref('all')
  const expanded = ref<string | null>(null)

  const filtered = computed(() =>
    projects.filter((p) => {
      if (semFilter.value !== 'all' && !p.semesters.includes(semFilter.value)) return false
      if (statusFilter.value !== 'all' && p.status !== statusFilter.value) return false
      if (partnerFilter.value !== 'all' && p.partnerId !== partnerFilter.value) return false
      return true
    })
  )

  function projectStudents(projectId: string) {
    return students.filter((s) => s.projects.includes(projectId))
  }
</script>

<template>
  <div style="padding: 28px 32px">
    <h1
      class="font-display"
      style="font-size: 20px; font-weight: 700; color: #1a3a1a; margin-bottom: 18px"
    >
      Projects
    </h1>
    <div class="filter-bar" style="margin-bottom: 16px">
      <select v-model="semFilter">
        <option value="all">All Semesters</option>
        <option v-for="s in semesters" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
      <select v-model="statusFilter">
        <option value="all">All Statuses</option>
        <option value="Active">Active</option>
        <option value="Completed">Completed</option>
        <option value="Paused">Paused</option>
      </select>
      <select v-model="partnerFilter">
        <option value="all">All Partners</option>
        <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <span style="color: #5a6b52; font-size: 12px; margin-left: auto"
        >{{ filtered.length }} projects</span
      >
    </div>

    <div style="display: flex; flex-direction: column; gap: 12px">
      <div
        v-for="pr in filtered"
        :key="pr.id"
        class="stat-card"
        style="padding: 0; overflow: hidden; cursor: pointer"
        @click="expanded = expanded === pr.id ? null : pr.id"
      >
        <div style="padding: 14px 20px; display: flex; align-items: center; gap: 16px">
          <div style="flex: 1">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px">
              <span style="font-weight: 700; font-size: 14px; color: #1a3a1a">{{ pr.name }}</span>
              <StatusBadge :status="pr.status" />
            </div>
            <div style="font-size: 12px; color: #5a6b52">
              {{ getPartnerById(pr.partnerId)?.name }} · {{ pr.description }}
            </div>
          </div>
          <div style="display: flex; gap: 20px; align-items: center">
            <div style="text-align: center">
              <div class="mono" style="font-weight: 700; font-size: 18px; color: #c45c1a">
                {{ pr.semesters.length }}
              </div>
              <div style="font-size: 10.5px; color: #5a6b52">semesters</div>
            </div>
            <div style="text-align: center">
              <div class="mono" style="font-weight: 700; font-size: 18px; color: #2d6a2d">
                {{ projectStudents(pr.id).length }}
              </div>
              <div style="font-size: 10.5px; color: #5a6b52">students</div>
            </div>
            <span style="color: #5a6b52; font-size: 18px">{{
              expanded === pr.id ? '▲' : '▼'
            }}</span>
          </div>
        </div>
        <div
          v-if="expanded === pr.id"
          style="border-top: 1px solid #cdd8c5; padding: 14px 20px; background: #f6f8f3"
        >
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px">
            <div>
              <div
                style="
                  font-size: 10.5px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.06em;
                  color: #5a6b52;
                  margin-bottom: 8px;
                "
              >
                Semesters
              </div>
              <div v-for="s in pr.semesters" :key="s" style="font-size: 12.5px; margin-bottom: 4px">
                <span class="mono" style="color: #c45c1a; font-size: 11px">{{ s }}</span>
                · {{ getSemesterLabel(s) }}
              </div>
            </div>
            <div>
              <div
                style="
                  font-size: 10.5px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.06em;
                  color: #5a6b52;
                  margin-bottom: 8px;
                "
              >
                Students
              </div>
              <div
                v-for="s in projectStudents(pr.id)"
                :key="s.id"
                style="font-size: 12.5px; margin-bottom: 4px"
              >
                <span style="font-weight: 500">{{ s.name }}</span>
                <span
                  v-if="s.isMentor"
                  class="badge"
                  style="background: #fef9c3; color: #854d0e; margin-left: 6px; font-size: 10px"
                  >Mentor</span
                >
              </div>
            </div>
            <div>
              <div
                style="
                  font-size: 10.5px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.06em;
                  color: #5a6b52;
                  margin-bottom: 8px;
                "
              >
                Partner Contact
              </div>
              <div style="font-size: 12.5px; font-weight: 600; margin-bottom: 2px">
                {{ getPartnerById(pr.partnerId)?.contact }}
              </div>
              <div style="font-size: 12px; color: #5a6b52; margin-bottom: 2px">
                {{ getPartnerById(pr.partnerId)?.email }}
              </div>
              <div style="font-size: 12px; color: #5a6b52">
                {{ getPartnerById(pr.partnerId)?.phone }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
