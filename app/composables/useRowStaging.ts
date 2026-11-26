/**
 * Purpose
 * Provide the use row staging logic used by other parts of ESA.
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
// Ambient access to a tab's staging store for everything rendered inside a row expansion.
//
// `staging` and `saving` are the same object for every node in a tab's subtree, so they inject.
// `rowId`, the row record, and the card being rendered vary per node and stay props — injection
// cannot express per-instance values, and a per-row provide would be worse than the prop.

/**
 * Row-expansion components only ever edit a row's own fields or its nested children — never the
 * row-lifecycle group (`rows`), which is DataTable.vue's own machinery. Narrowing the injected type
 * to this subset keeps that distinction visible at every call site that injects it.
 */
export type RowFieldStaging = Pick<StagedChanges, 'fields' | 'children'>

export interface RowStagingContext {
  staging: RowFieldStaging
  saving: Readonly<Ref<boolean>>
}

// Use Symbol to initialize ROW_STAGING_KEY.
export const ROW_STAGING_KEY: InjectionKey<RowStagingContext> = Symbol('row-staging')

// Define the helper that will provide row staging.
export function provideRowStaging(context: RowStagingContext) {
  // Call provide to run this step.
  provide(ROW_STAGING_KEY, context)
}

// Define the helper that will use row staging.
export function useRowStaging(): RowStagingContext {
  // Use inject to initialize context.
  const context = inject(ROW_STAGING_KEY)
  // Check whether !context before running this branch.
  if (!context) throw new Error('useRowStaging() needs provideRowStaging() on an ancestor')
  // Pass context back to the caller.
  return context
}
