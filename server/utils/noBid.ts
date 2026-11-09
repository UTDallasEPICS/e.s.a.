// Helpers for students who did not submit a bid (see docs/design/ui.md §4.3.1).
//
// A "no-bid" student is a bid-file row that ends up with zero usable project choices.
// The importer places each of them on one project that fits their major by writing that
// project in as their Choice 1, so the solver treats them like any other bidder, and sets
// Enrollment.noBid so later steps can recognise them.

import { createHash } from 'node:crypto'
import type { ProjectType } from '@@/prisma/generated/client'

// Same major groups the solver uses for its major-fit bonus (server/services/CPSAT/team_generator.py).
const SOFTWARE_MAJORS = new Set(['CS', 'SE', 'DS'])
const HARDWARE_MAJORS = new Set(['EE', 'ME', 'BME', 'CE'])

export interface PlacementCandidate {
  projectId: string
  projectName: string
  type: ProjectType
  /** How many students are already headed to this project (used to spread no-bid students out). */
  load: number
}

/** 0 = project type matches the major, 1 = "Both" project (fits anyone), 2 = no particular fit. */
function fitRank(major: string, type: ProjectType): number {
  if (SOFTWARE_MAJORS.has(major) && type === 'SOFTWARE') return 0
  if (HARDWARE_MAJORS.has(major) && type === 'HARDWARE') return 0
  if (type === 'BOTH') return 1
  return 2
}

/**
 * Pick the project a no-bid student should be placed on: best major fit first, then the
 * least-loaded team, then alphabetical so the result is deterministic.
 */
export function pickProjectForMajor(
  major: string,
  candidates: PlacementCandidate[]
): PlacementCandidate | null {
  if (!candidates.length) return null
  return (
    [...candidates].sort(
      (a, b) =>
        fitRank(major, a.type) - fitRank(major, b.type) ||
        a.load - b.load ||
        a.projectName.localeCompare(b.projectName)
    )[0] ?? null
  )
}

/**
 * Stable stand-in netID for a row that has no SSO ID, so re-uploading updates the same
 * student. Keyed on the email when there is one (unique per student), else the full name.
 * The hash keeps names apart whose ASCII slug is empty or identical (e.g. non-Latin names).
 */
export function placeholderNetID(firstName: string, lastName: string, email?: string | null): string {
  const slug = `${firstName} ${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const key = (email || `${firstName} ${lastName}`).normalize('NFKC').trim().toLowerCase()
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 8)
  return ['nobid', slug, hash].filter(Boolean).join('-')
}
