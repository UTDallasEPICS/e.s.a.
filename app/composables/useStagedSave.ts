/**
 * Purpose
 * Provide the use staged save logic used by other parts of ESA.
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
// The envelope every tab's Confirm shares: the delete confirmation, the saving flag, the outer
// create -> update -> delete ordering, the reset-and-refresh, and one error toast.
//
// It deliberately does not try to generalize the requests themselves. What each tab does with a
// StagedRecord is irreducibly different — Projects has to remap team ids it just created, Students
// has to delete before it creates and append-then-move its choices — but all of that is intra-record
// domain logic that belongs in the tab, passed in as `create` / `update` / `remove`.

import { errorMessage } from '~/utils/errors'
import { plural } from '~/utils/labels'

export interface StagedSaveOptions {
  staging: StagedChanges
  /** Lowercase singular for the delete confirmation title, e.g. `partner`. */
  entity: string
  /** The cascade sentence shown under that title. */
  cascade: string
  /** Cascade counts for the rows about to be deleted; the tab reads its own fetched list. */
  affected?: (ids: string[]) => { label: string; count: number }[]
  refresh: () => Promise<unknown>
  create: (record: StagedRecord) => Promise<void>
  update: (record: StagedRecord) => Promise<void>
  delete: (id: string) => Promise<void>
}

// Define the helper that will use staged save.
export function useStagedSave(options: StagedSaveOptions) {
  // Use useConfirm to initialize confirm.
  const confirm = useConfirm()
  // Use useToast to initialize toast.
  const toast = useToast()
  // Store saving as state so Vue reacts when it changes.
  const saving = ref(false)

  // Define the helper that will on save.
  async function onSave(payload: StagedPayload) {
    // Check whether payload.deleted.length before running this branch.
    if (payload.deleted.length) {
      // Define ok for the steps below.
      const ok = await confirm({
        title: `Delete ${plural(payload.deleted.length, options.entity)}?`,
        description: options.cascade,
        affected: options.affected?.(payload.deleted),
        confirmLabel: 'Delete',
      })
      // Check whether !ok before running this branch.
      if (!ok) return
    }

    // Update saving.value with the value on the right.
    saving.value = true
    try {
      // Repeat the following steps for each item in payload.created.
      for (const record of payload.created) await options.create(record)
      // Repeat the following steps for each item in payload.updated.
      for (const record of payload.updated) await options.update(record)
      // Repeat the following steps for each item in payload.deleted.
      for (const id of payload.deleted) await options.delete(id)
      // Call options.staging.reset to run this step.
      options.staging.reset()
      await options.refresh()
    } catch (error: any) {
      // Call toast.add to run this step.
      toast.add({
        title: 'Save failed',
        description: errorMessage(error),
        color: 'error',
      })
    } finally {
      // Update saving.value with the value on the right.
      saving.value = false
    }
  }

  // Pass { saving, onSave } back to the caller.
  return { saving, onSave }
}
