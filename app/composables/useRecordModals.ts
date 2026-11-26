/**
 * Purpose
 * Provide the use record modals logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
// Awaited openers for the Database page's minor-record modals, following useConfirm.ts: one lazily
// created overlay instance per modal, opened with its options and resolved with a draft.
//
// Every opener normalizes to `null`. useOverlay resolves `undefined` when a modal is dismissed by
// ESC or an outside click rather than through its own Cancel button, and a caller testing the
// result must not have to know the difference.

import ContactFormModal from '~/components/modals/ContactFormModal.vue'
import TeamFormModal from '~/components/modals/TeamFormModal.vue'
import MemberPickerModal from '~/components/modals/MemberPickerModal.vue'
import MoveMemberModal from '~/components/modals/MoveMemberModal.vue'
import ProjectPickerModal from '~/components/modals/ProjectPickerModal.vue'
import SemesterInfoModal from '~/components/modals/SemesterInfoModal.vue'
import type { ProjectRead } from '#server/services/projectService'
import type { StudentRead } from '#server/services/studentService'
import type { SelectOption } from '~/utils/options'
import type { ContactDraft, SemesterInfoDraft, TeamDraft } from '~/utils/recordDrafts'

// Define the helper that will use record modals.
export function useRecordModals() {
  // Use useOverlay to initialize overlay.
  const overlay = useOverlay()

  // Use overlay.create to initialize contactModal.
  const contactModal = overlay.create(ContactFormModal)
  // Use overlay.create to initialize teamModal.
  const teamModal = overlay.create(TeamFormModal)
  // Use overlay.create to initialize memberModal.
  const memberModal = overlay.create(MemberPickerModal)
  // Use overlay.create to initialize moveModal.
  const moveModal = overlay.create(MoveMemberModal)
  // Use overlay.create to initialize projectModal.
  const projectModal = overlay.create(ProjectPickerModal)
  // Use overlay.create to initialize semesterInfoModal.
  const semesterInfoModal = overlay.create(SemesterInfoModal)

  // Define the helper that will open contact modal.
  async function openContactModal() {
    // Pass ((await contactModal.open().result) ?? null) as ContactDraft | null back to the caller.
    return ((await contactModal.open().result) ?? null) as ContactDraft | null
  }

  // Define the helper that will open team modal.
  async function openTeamModal(props: { semesters: SelectOption[]; defaultSemesterId?: string }) {
    // Pass ((await teamModal.open(props).result) ?? null) as TeamDraft | null back to the caller.
    return ((await teamModal.open(props).result) ?? null) as TeamDraft | null
  }

  // Define the helper that will open member modal.
  async function openMemberModal(props: { title: string; students: StudentRead[] }) {
    // Pass ((await memberModal.open(props).result) ?? null) as StudentRead | null back to the caller.
    return ((await memberModal.open(props).result) ?? null) as StudentRead | null
  }

  // Define the helper that will open move modal.
  async function openMoveModal(props: { teams: SelectOption[] }) {
    // Pass ((await moveModal.open(props).result) ?? null) as string | null back to the caller.
    return ((await moveModal.open(props).result) ?? null) as string | null
  }

  // Define the helper that will open project picker.
  async function openProjectPicker(props: { title: string; projects: ProjectRead[] }) {
    // Pass ((await projectModal.open(props).result) ?? null) as ProjectRead | null back to the caller.
    return ((await projectModal.open(props).result) ?? null) as ProjectRead | null
  }

  // Define the helper that will open semester info modal.
  async function openSemesterInfoModal(props: {
    isMentor: boolean
    semesters: SelectOption[]
    taken: { STUDENT: string[]; MENTOR: string[] }
    projects: ProjectRead[]
  }) {
    // Pass ((await semesterInfoModal.open(props).result) ?? null) as SemesterInfoDraft | null back to the caller.
    return ((await semesterInfoModal.open(props).result) ?? null) as SemesterInfoDraft | null
  }

  // Pass { openContactModal, openTeamModal, openMemberModal, openMoveModal, openProjectPicker, openSemesterIn back to the caller.
  return {
    openContactModal,
    openTeamModal,
    openMemberModal,
    openMoveModal,
    openProjectPicker,
    openSemesterInfoModal,
  }
}
