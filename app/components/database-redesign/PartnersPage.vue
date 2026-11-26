<script setup lang="ts">
  /**
   * Purpose
   * Render the partners page part of the ESA interface.
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
  // Use defineProps to initialize props.
  const props = defineProps<{ initialPartnerId?: string | null }>()
  import { partners, projects, students } from '../data'
  import StatusBadge from './StatusBadge.vue'

  // Use useState to initialize semester.
  const semester = useState<string>('epics-selected-semester', () => 'FA26')
  // Define the helper that will partner projects.
  function partnerProjects(partnerId: string) {
    // Pass projects.filter((p) => p.partnerId === partnerId && (semester.value === 'all' || p.semesters.include back to the caller.
    return projects.filter((p) => p.partnerId === partnerId && (semester.value === 'all' || p.semesters.includes(semester.value))).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true}))
  }

  // Define the helper that will partner student count.
  function partnerStudentCount(partnerId: string) {
    // Use partnerProjects to initialize prs.
    const prs = partnerProjects(partnerId)
    // Pass new Set( prs.flatMap((pr) => students.filter((s) => s.projects.includes(pr.id)).map((s) => s.id)) ). back to the caller.
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
      <div v-for="partner in partners.filter(partner => !props.initialPartnerId || partner.id === props.initialPartnerId)" :key="partner.id" class="stat-card">
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
            >{{ partnerProjects(partner.id).length }} in selection</span
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
