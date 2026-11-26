/**
 * Purpose
 * Provide the use semester filter logic used by other parts of ESA.
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
// The semester filter, gated rather than restored (§2.3.2).
//
// A tab holding staged changes has to be asked before the filter moves, because the move refetches
// its list and would orphan that work. The obvious shape — let the filter change, then put it back
// if the user declines — refetches twice and flashes the wrong dataset behind the dialog, because
// each tab's `useFetch` query is reactive to the id. So the id moves only after the answer.

/** What `request` has to ask before moving the filter. `StagedChanges` satisfies this as-is. */
export interface SemesterGuard {
  isDirty: Readonly<Ref<boolean>>
  reset: () => void
}

export interface SemesterFilterContext {
  /** The committed id. Only `request` moves it. */
  semesterId: Readonly<Ref<string | undefined>>
  /** Ask to move the filter. Resolves false when a dirty guard declined and the id never moved. */
  request: (next: string | undefined) => Promise<boolean>
  /**
   * Ask before any other destructive navigation — switching tabs unmounts the panel and takes its
   * staged changes with it. Resolves true (having reset the dirty stores) when it is safe to go on.
   */
  confirmDiscard: (description: string) => Promise<boolean>
  /** Register a store to be asked. Deregisters itself when the owning scope is disposed. */
  guard: (guard: SemesterGuard) => void
}

// Use Symbol to initialize SEMESTER_FILTER_KEY.
export const SEMESTER_FILTER_KEY: InjectionKey<SemesterFilterContext> = Symbol('semester-filter')

// Define the helper that will provide semester filter.
export function provideSemesterFilter(): SemesterFilterContext {
  // Use useSemesters to initialize { semesters }.
  const { semesters } = useSemesters()
  // Store semesterId as state so Vue reacts when it changes.
  const semesterId = ref<string | undefined>(semesters.value[0]?.id)
  // Define guards for the steps below.
  const guards = new Set<SemesterGuard>()
  // Use useConfirm to initialize confirm.
  const confirm = useConfirm()

  // "All semesters" is `undefined`, and so is "no default applied yet" — the two are
  // indistinguishable by looking at `semesterId` alone. So whether the user has made their own
  // choice is tracked separately here, rather than inferred from `semesterId.value === undefined`,
  // otherwise a deliberate "All semesters" selection would get overwritten the next time this
  // watcher runs (e.g. after a `semesters` refetch elsewhere).
  let userHasChosen = false

  // `useFetch('/api/semesters', ...)` above isn't awaited, so on a client-side navigation
  // `semesters.value` above can still be the empty `default` when this runs. Once the fetch
  // resolves, fill in the default then — but only if nothing has claimed `semesterId` since.
  watch(semesters, (list) => {
    // Check whether !userHasChosen && semesterId.value === undefined && list.length before running this branch.
    if (!userHasChosen && semesterId.value === undefined && list.length) {
      // Update semesterId.value with the value on the right.
      semesterId.value = list[0]!.id
    }
  })

  // Define the helper that will guard.
  function guard(entry: SemesterGuard) {
    // Call guards.add to run this step.
    guards.add(entry)
    // Call onScopeDispose to run this step.
    onScopeDispose(() => guards.delete(entry))
  }

  // Define the helper that will confirm discard.
  async function confirmDiscard(description: string) {
    // Use [...guards].filter to initialize dirty.
    const dirty = [...guards].filter((entry) => entry.isDirty.value)
    // Check whether dirty.length before running this branch.
    if (dirty.length) {
      // Define ok for the steps below.
      const ok = await confirm({
        title: 'Discard staged changes?',
        description,
        confirmLabel: 'Discard',
      })
      // Check whether !ok before running this branch.
      if (!ok) return false
    }
    // Repeat the following steps for each item in dirty.
    for (const entry of dirty) entry.reset()
    // Pass true back to the caller.
    return true
  }

  // Define the helper that will request.
  async function request(next: string | undefined) {
    // Check whether next === semesterId.value before running this branch.
    if (next === semesterId.value) return true
    // Define ok for the steps below.
    const ok = await confirmDiscard(
      'Changing the semester filter will discard everything you have staged.'
    )
    // Check whether !ok before running this branch.
    if (!ok) return false
    // Update userHasChosen with the value on the right.
    userHasChosen = true
    // Update semesterId.value with the value on the right.
    semesterId.value = next
    // Pass true back to the caller.
    return true
  }

  // Define context for the steps below.
  const context: SemesterFilterContext = {
    semesterId: readonly(semesterId),
    request,
    confirmDiscard,
    guard,
  }
  // Call provide to run this step.
  provide(SEMESTER_FILTER_KEY, context)
  // Pass context back to the caller.
  return context
}

// Define the helper that will use semester filter.
export function useSemesterFilter(): SemesterFilterContext {
  // Use inject to initialize context.
  const context = inject(SEMESTER_FILTER_KEY)
  // Check whether !context before running this branch.
  if (!context) throw new Error('useSemesterFilter() needs provideSemesterFilter() on an ancestor')
  // Pass context back to the caller.
  return context
}
