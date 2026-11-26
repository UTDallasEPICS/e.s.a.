/**
 * Purpose
 * Provide the use semester cards logic used by other parts of ESA.
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
// The derivation behind the Students row expansion (§3.2.3).
//
// A student's semester is presented as one card, but it is assembled from two staged collections:
// an Enrollment (the Student card) or a mentor Membership (the Mentor card), plus the Membership
// holding the team assignment. Because there is no `PUT /api/memberships/:id`, changing a team is
// staged as a delete plus a create — `membershipSlot` re-collapses that pair so the card can read
// as a single Team field.

import type { ProjectRead } from '#server/services/projectService'
import type { StudentRead } from '#server/services/studentService'
import type { ChoiceRead } from '#server/services/choiceService'

/** `baseRank` is a client-only tiebreak (the rank a choice had before this session's edits) that
 *  never reaches the server, so it's layered onto `ChoiceRead` here rather than in the service. */
type StagedChoice = ChoiceRead & { baseRank?: number }

/** A student flattened with the selected semester's enrollment, so those columns can display. */
export interface StudentRow extends StudentRead {
  meetingDay: string | null
  gender: string | null
  major: string | null
  year: string | null
  class: string | null
}

export interface SemesterCard {
  key: string
  role: 'Student' | 'Mentor'
  semesterId: string
  label: string
  /** The enrollment behind a Student card, or the membership behind a Mentor card. */
  childId: string
  state: StageState
  deleted: boolean
  teamId?: string
  teamChanged: boolean
  /** The fetched membership holding this card's team assignment, if there is one. */
  membershipId?: string
  /** A staged-new membership standing in for it. */
  addedMembershipId?: string
}

export interface ChoiceEntry {
  id: string
  projectId: string
  rank: number
  baseRank: number
  state: StageState
  isNew: boolean
  deleted: boolean
}

// Define the helper that will use semester cards.
export function useSemesterCards(input: {
  staging: RowFieldStaging
  projects: Ref<ProjectRead[]>
  semesterLabel: (id?: string | null) => string
  semesterSortKey: (id?: string | null) => number
}) {
  // Define { staging, projects, semesterLabel, semesterSortKey } for the steps below.
  const { staging, projects, semesterLabel, semesterSortKey } = input

  // Recalculate teamIndex when the values it reads change.
  const teamIndex = computed(() => {
    // Define index for the steps below.
    const index = new Map<string, { teamId: string; semesterId: string; project: ProjectRead }>()
    // Repeat the following steps for each item in projects.value.
    for (const project of projects.value) {
      // Repeat the following steps for each item in project.Teams.
      for (const team of project.Teams) {
        // Call index.set to run this step.
        index.set(team.id, { teamId: team.id, semesterId: team.semesterId, project })
      }
    }
    // Pass index back to the caller.
    return index
  })

  // Define the helper that will team in.
  function teamIn(project: ProjectRead, semesterId: string) {
    // Pass project.Teams.find((team) => team.semesterId === semesterId) back to the caller.
    return project.Teams.find((team) => team.semesterId === semesterId)
  }

  // Define the helper that will team project.
  function teamProject(teamId?: string) {
    // Pass teamId ? teamIndex.value.get(teamId)?.project : undefined back to the caller.
    return teamId ? teamIndex.value.get(teamId)?.project : undefined
  }

  // Define the helper that will membership semester.
  function membershipSemester(membership: MergedChild<any>) {
    // Pass membership.isNew ? membership.record.semesterId : membership.record.Team?.semesterId back to the caller.
    return membership.isNew ? membership.record.semesterId : membership.record.Team?.semesterId
  }

  /**
   * The one team assignment for a semester+role slot, as a fetched membership, a staged-new one, or
   * both — the two halves of a team change have to read as a single field on the card. A Student
   * slot is unambiguous (one Enrollment, one team) so `anchorId` can be omitted and the first match
   * taken; a Mentor can hold several simultaneous team memberships in one semester, so their slot is
   * pinned to a specific membership by id — either the fetched one being edited, or a staged-new one
   * tagged `replacesId` when it's retargeting that fetched membership to a different team.
   */
  function membershipSlot(
    row: StudentRow,
    rowId: string,
    semesterId: string,
    isMentor: boolean,
    anchorId?: string
  ) {
    // Use staging.children.merge to initialize merged.
    const merged = staging.children.merge(rowId, 'Memberships')
    // Define existing for the steps below.
    let existing: MergedChild<any> | undefined
    // Define added for the steps below.
    let added: MergedChild<any> | undefined
    // Repeat the following steps for each item in merged.
    for (const membership of merged) {
      // Check whether !!membership.record.isMentor !== isMentor before running this branch.
      if (!!membership.record.isMentor !== isMentor) continue
      // Check whether membershipSemester(membership) !== semesterId before running this branch.
      if (membershipSemester(membership) !== semesterId) continue
      // Check whether anchorId before running this branch.
      if (anchorId) {
        // Check whether membership.isNew before running this branch.
        if (membership.isNew) {
          // Check whether membership.id === anchorId || membership.record.replacesId === anchorId before running this branch.
          if (membership.id === anchorId || membership.record.replacesId === anchorId) {
            added ??= membership
          }
        } else if (membership.id === anchorId) {
          // Update existing with the value on the right.
          existing = membership
        }
        continue
      }
      // Check whether membership.isNew before running this branch.
      if (membership.isNew) added ??= membership
      else existing ??= membership
    }
    // Define originalTeamId for the steps below.
    const originalTeamId = existing
      ? (row.Memberships ?? []).find((m) => m.id === existing!.id)?.teamId
      : undefined
    // Define teamId for the steps below.
    const teamId = added
      ? added.record.teamId
      : existing && !existing.deleted
        ? existing.record.teamId
        : undefined
    // Pass { existing, added, teamId, originalTeamId, changed: teamId !== originalTeamId } back to the caller.
    return { existing, added, teamId, originalTeamId, changed: teamId !== originalTeamId }
  }

  // Define the helper that will cards for.
  function cardsFor(row: StudentRow, rowId: string): SemesterCard[] {
    // Define cards for the steps below.
    const cards: SemesterCard[] = []

    // Use staging.children.merge to initialize enrollments.
    const enrollments = staging.children.merge(rowId, 'Enrollments')
    // Repeat the following steps for each item in enrollments.
    for (const enrollment of enrollments) {
      // Define semesterId for the steps below.
      const semesterId = enrollment.record.semesterId
      // Check whether !semesterId before running this branch.
      if (!semesterId) continue
      // Use membershipSlot to initialize slot.
      const slot = membershipSlot(row, rowId, semesterId, false)
      // Call cards.push to run this step.
      cards.push({
        key: `enrollment:${enrollment.id}`,
        role: 'Student',
        semesterId,
        label: `${semesterLabel(semesterId)} — Student`,
        childId: enrollment.id,
        state: enrollment.state !== 'clean' ? enrollment.state : slot.changed ? 'edited' : 'clean',
        deleted: enrollment.deleted,
        teamId: slot.teamId,
        // A green card needs no per-field outline; the whole card already reads as an addition.
        teamChanged: !enrollment.isNew && slot.changed,
        membershipId: slot.existing?.id,
        addedMembershipId: slot.added?.id,
      })
    }

    // A mentor can hold several simultaneous team memberships in one semester (leading more than one
    // project), so each mentor Membership is its own card — anchored to the fetched membership it
    // came from, or to itself when it's a staged-new one with no fetched counterpart to replace.
    const memberships = staging.children.merge(rowId, 'Memberships')
    // Define mentorAnchors for the steps below.
    const mentorAnchors = new Map<string, string>()
    // Repeat the following steps for each item in memberships.
    for (const membership of memberships) {
      // Check whether !membership.record.isMentor before running this branch.
      if (!membership.record.isMentor) continue
      // Use membershipSemester to initialize semesterId.
      const semesterId = membershipSemester(membership)
      // Check whether !semesterId before running this branch.
      if (!semesterId) continue
      // Check whether membership.isNew && membership.record.replacesId before running this branch.
      if (membership.isNew && membership.record.replacesId) continue
      // Call mentorAnchors.set to run this step.
      mentorAnchors.set(membership.id, semesterId)
    }
    // Repeat the following steps for each item in mentorAnchors.
    for (const [anchorId, semesterId] of mentorAnchors) {
      // Use membershipSlot to initialize slot.
      const slot = membershipSlot(row, rowId, semesterId, true, anchorId)
      // Define anchor for the steps below.
      const anchor = slot.existing ?? slot.added
      // Check whether !anchor before running this branch.
      if (!anchor) continue
      // Define deleted for the steps below.
      const deleted = !!slot.existing?.deleted && !slot.added
      // Call cards.push to run this step.
      cards.push({
        key: `mentor:${anchorId}`,
        role: 'Mentor',
        semesterId,
        label: `${semesterLabel(semesterId)} — Mentor`,
        childId: anchor.id,
        state: deleted ? 'deleted' : slot.existing && slot.added ? 'edited' : anchor.state,
        deleted,
        teamId: slot.teamId,
        teamChanged: !anchor.isNew && slot.changed,
        membershipId: slot.existing?.id,
        addedMembershipId: slot.added?.id,
      })
    }

    // Pass cards.sort((a, b) => semesterSortKey(b.semesterId) - semesterSortKey(a.semesterId)) back to the caller.
    return cards.sort((a, b) => semesterSortKey(b.semesterId) - semesterSortKey(a.semesterId))
  }

  // Define the helper that will set team.
  function setTeam(row: StudentRow, rowId: string, card: SemesterCard, project?: ProjectRead) {
    // Define isMentor for the steps below.
    const isMentor = card.role === 'Mentor'
    // Define teamId for the steps below.
    const teamId = project ? teamIn(project, card.semesterId)?.id : undefined
    // Pinned to this card's own membership so a change on one mentor slot can't be picked up by
    // `membershipSlot`'s search and misattributed to a sibling mentor slot in the same semester.
    const anchorId = card.membershipId ?? card.addedMembershipId
    // Use membershipSlot to initialize slot.
    const slot = membershipSlot(row, rowId, card.semesterId, isMentor, anchorId)

    // A staged-new membership with no fetched counterpart is simply retargeted in place; on a
    // Mentor card it is the card itself, so it survives being cleared.
    if (slot.added && !slot.existing) {
      // Check whether !teamId && !isMentor before running this branch.
      if (!teamId && !isMentor) staging.children.undo(rowId, 'Memberships', slot.added.id)
      else staging.children.set(rowId, 'Memberships', slot.added.id, 'teamId', teamId)
      return
    }
    // Check whether slot.added before running this branch.
    if (slot.added) staging.children.undo(rowId, 'Memberships', slot.added.id)
    // Check whether !slot.existing before running this branch.
    if (!slot.existing) {
      // Check whether teamId before running this branch.
      if (teamId) {
        // Call staging.children.add to run this step.
        staging.children.add(rowId, 'Memberships', {
          semesterId: card.semesterId,
          teamId,
          isMentor,
        })
      }
      return
    }
    // Define shouldDelete for the steps below.
    const shouldDelete = teamId !== slot.originalTeamId
    // Check whether slot.existing.deleted !== shouldDelete before running this branch.
    if (slot.existing.deleted !== shouldDelete) {
      // Check whether shouldDelete before running this branch.
      if (shouldDelete) staging.children.markDeleted(rowId, 'Memberships', slot.existing.id)
      else staging.children.undo(rowId, 'Memberships', slot.existing.id)
    }
    // Check whether teamId && shouldDelete before running this branch.
    if (teamId && shouldDelete) {
      // `replacesId` links this staged-new membership back to the fetched one it's retargeting, so
      // `membershipSlot` can re-pair them into a single card even when a mentor has other, untouched
      // mentor memberships in the same semester. It's a client-only field — see `baseRank` above —
      // and never reaches the server.
      staging.children.add(rowId, 'Memberships', {
        semesterId: card.semesterId,
        teamId,
        isMentor,
        replacesId: slot.existing.id,
      })
    }
  }

  // Define the helper that will delete card.
  function deleteCard(rowId: string, card: SemesterCard) {
    // Check whether card.role === 'Student' before running this branch.
    if (card.role === 'Student') {
      // Dropping a staged-new card takes its staged team assignment with it, so nothing is left
      // behind to be POSTed for a card that is no longer on screen.
      if (card.state === 'new' && card.addedMembershipId) {
        // Call staging.children.undo to run this step.
        staging.children.undo(rowId, 'Memberships', card.addedMembershipId)
      }
      // Call staging.children.markDeleted to run this step.
      staging.children.markDeleted(rowId, 'Enrollments', card.childId)
      return
    }
    // Check whether card.addedMembershipId before running this branch.
    if (card.addedMembershipId) staging.children.undo(rowId, 'Memberships', card.addedMembershipId)
    // Check whether card.membershipId before running this branch.
    if (card.membershipId) staging.children.markDeleted(rowId, 'Memberships', card.membershipId)
  }

  // Define the helper that will undo card.
  function undoCard(rowId: string, card: SemesterCard) {
    // Check whether card.addedMembershipId before running this branch.
    if (card.addedMembershipId) staging.children.undo(rowId, 'Memberships', card.addedMembershipId)
    // Check whether card.membershipId before running this branch.
    if (card.membershipId) staging.children.undo(rowId, 'Memberships', card.membershipId)
    // Check whether card.role === 'Student' before running this branch.
    if (card.role === 'Student') staging.children.undo(rowId, 'Enrollments', card.childId)
  }

  /**
   * Merged choices for one semester, ordered by their effective rank. Ties — a choice that was just
   * moved onto a sibling's rank — break in favour of the mover, which is what the server's own rank
   * shifting produces once the edit is saved.
   */
  function choiceEntries(row: StudentRow, rowId: string, semesterId: string): ChoiceEntry[] {
    // Define originals for the steps below.
    const originals = row.Choices ?? []
    // Pass staging.children .merge<StagedChoice>(rowId, 'Choices') .filter((choice) => choice.record.semesterId back to the caller.
    return staging.children
      .merge<StagedChoice>(rowId, 'Choices')
      .filter((choice) => choice.record.semesterId === semesterId)
      .map((choice) => ({
        id: choice.id,
        projectId: choice.record.projectId,
        rank: choice.record.rank,
        baseRank: choice.isNew
          ? (choice.record.baseRank ?? choice.record.rank)
          : (originals.find((original) => original.id === choice.id)?.rank ?? choice.record.rank),
        state: choice.state,
        isNew: choice.isNew,
        deleted: choice.deleted,
      }))
      .sort((a, b) => a.rank - b.rank || b.baseRank - a.baseRank)
  }

  /**
   * Stages a new rank on the moved choice only. `PUT /api/choices/:id` shifts the siblings server
   * side, so rewriting every sibling here would fight it.
   */
  function moveChoice(rowId: string, entries: ChoiceEntry[], index: number, direction: -1 | 1) {
    // Define entry for the steps below.
    const entry = entries[index]
    // Define neighbour for the steps below.
    const neighbour = entries[index + direction]
    // Check whether !entry || !neighbour before running this branch.
    if (!entry || !neighbour) return
    // Call staging.children.set to run this step.
    staging.children.set(rowId, 'Choices', entry.id, 'rank', entry.rank + direction)
  }

  // Pass { teamIn, teamProject, cardsFor, setTeam, deleteCard, undoCard, choiceEntries, moveChoice, } back to the caller.
  return {
    teamIn,
    teamProject,
    cardsFor,
    setTeam,
    deleteCard,
    undoCard,
    choiceEntries,
    moveChoice,
  }
}
