/**
 * Purpose
 * Provide the use confirm logic used by other parts of ESA.
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
import ConfirmationModal from '~/components/modals/ConfirmationModal.vue'

export interface ConfirmOptions {
  title: string
  description?: string
  affected?: { label: string; count: number }[]
  confirmLabel?: string
}

// Define modal for the steps below.
let modal: { open: (props: ConfirmOptions) => { result: Promise<boolean> } } | undefined

// Define the helper that will use confirm.
export function useConfirm() {
  // Use useOverlay to initialize overlay.
  const overlay = useOverlay()
  modal ??= overlay.create(ConfirmationModal)

  // Pass (options: ConfirmOptions) => modal!.open(options).result back to the caller.
  return (options: ConfirmOptions) => modal!.open(options).result
}
