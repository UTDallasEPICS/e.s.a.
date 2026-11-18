<script setup lang="ts">
  import { partners, projects, students } from '../data'
  import StatusBadge from './StatusBadge.vue'

  function partnerProjects(partnerId: string) {
    return projects.filter((p) => p.partnerId === partnerId)
  }

  function partnerStudentCount(partnerId: string) {
    const prs = partnerProjects(partnerId)
    return new Set(
      prs.flatMap((pr) => students.filter((s) => s.projects.includes(pr.id)).map((s) => s.id))
    ).size
  }
</script>

<template>
  <div style="padding: 28px 32px">
    <h1
      class="font-display"
      style="font-size: 20px; font-weight: 700; color: #1a3a1a; margin-bottom: 18px"
    >
      Project Partners
    </h1>
    <div
      style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px"
    >
      <div v-for="partner in partners" :key="partner.id" class="stat-card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
          "
        >
          <div>
            <div style="font-weight: 700; font-size: 15px; color: #1a3a1a; margin-bottom: 2px">
              {{ partner.name }}
            </div>
            <div style="font-size: 12.5px; color: #5a6b52">
              Primary Contact: {{ partner.contact }}
            </div>
          </div>
          <span class="badge" style="background: #d4edda; color: #145214"
            >{{ partner.activeProjects }} active</span
          >
        </div>
        <div style="font-size: 12px; color: #5a6b52; margin-bottom: 12px">
          <div>{{ partner.email }}</div>
          <div>{{ partner.phone }}</div>
        </div>
        <div style="border-top: 1px solid #cdd8c5; padding-top: 12px">
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
            Projects
          </div>
          <div
            v-for="pr in partnerProjects(partner.id)"
            :key="pr.id"
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 6px;
            "
          >
            <span style="font-size: 12.5px; font-weight: 500">{{ pr.name }}</span>
            <StatusBadge :status="pr.status" />
          </div>
        </div>
        <div
          style="
            border-top: 1px solid #cdd8c5;
            margin-top: 10px;
            padding-top: 10px;
            display: flex;
            gap: 20px;
          "
        >
          <div>
            <div class="mono" style="font-weight: 700; font-size: 16px; color: #2d6a2d">
              {{ partnerProjects(partner.id).length }}
            </div>
            <div style="font-size: 11px; color: #5a6b52">total projects</div>
          </div>
          <div>
            <div class="mono" style="font-weight: 700; font-size: 16px; color: #c45c1a">
              {{ partnerStudentCount(partner.id) }}
            </div>
            <div style="font-size: 11px; color: #5a6b52">total students</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
