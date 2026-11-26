/**
 * Purpose
 * Provide the icons logic used by other parts of ESA.
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
// Icon Reference (docs/design/ui.md §2.7)
export const ACTION_ICONS = {
  add: 'i-heroicons-plus',
  delete: 'i-heroicons-minus',
  confirm: 'i-heroicons-check',
  cancel: 'i-heroicons-x-mark',
  undo: 'i-heroicons-arrow-uturn-left',
  sortUnset: 'i-heroicons-arrows-up-down',
  sortAsc: 'i-heroicons-arrow-up',
  sortDesc: 'i-heroicons-arrow-down',
  expand: 'i-heroicons-chevron-right',
  collapse: 'i-heroicons-chevron-down',
  moveUp: 'i-heroicons-arrow-up',
  moveDown: 'i-heroicons-arrow-down',
  move: 'i-heroicons-arrows-right-left',
  primary: 'i-heroicons-star',
  export: 'i-heroicons-arrow-down-tray',
  upload: 'i-heroicons-arrow-up-tray',
  generate: 'i-heroicons-sparkles',
} as const
