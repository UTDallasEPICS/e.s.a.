import ConfirmationModal from '~/components/modals/ConfirmationModal.vue'

export interface ConfirmOptions {
  title: string
  description?: string
  affected?: { label: string; count: number }[]
  confirmLabel?: string
  /** Red by default, for anything destructive; pass another colour for actions that aren't. */
  confirmColor?: 'primary' | 'error' | 'success' | 'neutral'
}

let modal: { open: (props: ConfirmOptions) => { result: Promise<boolean> } } | undefined

export function useConfirm() {
  const overlay = useOverlay()
  modal ??= overlay.create(ConfirmationModal)

  return (options: ConfirmOptions) => modal!.open(options).result
}
