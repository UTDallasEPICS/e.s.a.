# Team Formation Changes — What's New

What the **Team Formation** page does on this branch. Read this and `BRANCH_SETUP.md` (same folder) before working on this code.

## The problem this solves

Staff wanted to place certain 3200 students into teams *before* running the main algorithm on everyone else, so a returning student or a student with special circumstances can be locked into the right team first. That grew into a full workflow: generate, lock the teams you like, regenerate for the rest, and fix individual students by hand, always with each student's preferences in view.

## The steps

The page shows **one step at a time**. A step bar at the top shows where you are, with Back/Next at the bottom.

- **Moving between steps.** You can always go back to a step you've reached. Forward goes through Next, which waits for the data the step needs (the reason shows beside Next):
  1. **Semester & Day** needs a semester. The team list here is read-only (name, partner, members, a "Locked" label).
  2. **Bid File** needs saved bids for that semester/day. If bids are already saved, the step shows a summary and a **Replace bid file** button instead of the upload box. Replace warns what a re-upload does: students in the file are updated and their choices replaced, students not in the file are kept, and existing teams don't change until you generate again.
  3. **Lock 3200s** is optional. See below.
  4. **Generate** needs teams with members (generated now or earlier) before Next.
  5. **Arrange Teams**: the board. See below.
- Changing the semester or day starts over at step 1. Nothing auto-advances.
- Editing note: `UStepper` treats a *numeric* `v-model` as a 0-based index, so `activeSection` (1–5) is bound through a `stepIndex` computed.

## Step 3: Lock 3200 students (optional)

- **Min/Max 3200 per Project** are always visible, because they also drive Generate Teams. Max defaults to 4, so one popular project can't absorb all the 3200s. Min defaults to **1**, so every project needs at least one 3200. If there aren't enough 3200 students, generation fails with a message saying how many more are needed.
- Everything else is folded behind **Show 3200 students**:
  - **Lock one student:** pick a team from their dropdown and hit **Lock**. The dropdown is ordered by that student's own ranking, with a returning project flagged. Locked students are skipped by Generate Teams. **Unlock** clears the lock and leaves the student on their team.
  - **Suggest Placements** runs the algorithm on the unlocked 3200s only. It guarantees 1st or 2nd choice where possible, falls back to 3rd only when capacity forces it (flagged), and sets aside students who never bid. Each suggestion pre-fills the dropdown with a reason. **Lock All Suggested** locks them.
  - **Lock all** locks every unlocked 3200 into the team picked in their dropdown, or else the team they're on now. **Unlock all** keeps students on their current team and only clears the lock. Both ask for confirmation first.

## Step 5: Arrange Teams

- **All teams:** every team for the semester/day is a square in a grid. Each member shows the rank they gave that team (green 1st/2nd, amber 3rd, grey lower or unranked) and a **3200** tag where it applies. Each square has **Set aside**, **Improve** and a lock button. Locked teams sort last and can't be set aside.
- **Workbench:** teams you set aside (button or drag) sit side by side above the grid. Drag students between them; while dragging, each team shows that student's rank for it. Each card has Improve, Lock and Put back (×). Locking a team sends it back to the grid. The Workbench is only a view: only moves and locks are saved.
- **Every Workbench row** shows the student's **major**. With exactly two teams on the Workbench, it also shows **"here [rank] · there [rank]"**.
- **Compare and swap:** click a student to see their major, full ranking and what moving to each other Workbench team would mean. Then click a student on another Workbench team to get a **swap preview**: both students' before → after ranks, majors and rankings. Nothing saves until **Move** or **Confirm swap**. Warnings appear when someone would end up on a lower-ranked team, a team goes over max or under min size, or the 3200 min/max breaks. They don't block, because the decision is staff's.
- **Improve (one team):** lists each student on the team with their major, 3200 status and current rank, and offers a **Move** (to a team with room) or **Swap** (with someone who loses nothing) toward a team they ranked higher, across all teams for the day. Applying it sets both teams aside so you can see the result. When there's no fix, it says why for each higher choice: full, this team would drop below the minimum size, they're this team's only 3200, that team is at the 3200 max, that team is locked, or no bid submitted.
- A moved student keeps their lock state (`lock.post.ts` `replaceLocked`).

### Design rule: computed, not AI

Placement help must be **computed with fixed, explainable rules, not decided by AI**. Improve and the swap warnings are deterministic, rank-based rules with no external calls: the same data always gives the same answer. Don't add AI or LLM-based placement or recommendations without asking the team first.

## The Diego merge

Diego's branch added a parallel implementation of the "minimum 3200" idea (`min_3200_per_team`) plus a separate locking mechanism (locks passed on every solve call via `locked_student_assignments`/`locked_teams`, instead of being saved in the database). When the branches were merged:

- Only `min_upperclass_per_project` is connected to the UI. Diego's separate `min_3200_per_team` field did not survive.
- Diego's lock-passing mechanism is still in `team_generator.py` but unused: the app uses the database-backed `Membership.locked`. It has its own regression tests (`test_locking.py`).
- A merge bug left the minimum-3200 default inconsistent between the solver, the UI and `test.ts`. Diego's `test_minimum_3200.py` shows the default of 1 is intentional, so it's 1 everywhere now. `test.ts`, `test_minimum_3200.py` and `test_locking.py` all pass.

## How to use it

1. **Semester & Day:** pick a semester and meeting day.
2. **Bid File:** upload the bid CSV if nothing is saved yet.
3. **Lock 3200s (optional):** set the min/max range. Use Show 3200 students to suggest and lock placements.
4. **Generate:** set team sizes and hit Generate Teams.
5. **Arrange Teams:** use Improve to spot students who could be happier. Set aside the teams you want to fix, then compare, move or swap students. Lock the teams you're done with.
6. To re-solve everyone who isn't locked, go back to Generate and run it again.

## What's still open

- **Text-response skill matching:** using students' free-text answers to break ties for a contested spot. It would need to stay rule-based (see the design rule).
- **Scale change for oversubscribed choices:** weighting lower-ranked choices more when a student's top picks are full, for both 2200 and 3200 students. Same piece of work as the item above.
- **Students with no team yet:** the board doesn't show students who aren't on any team. See also the `no-bid-students` branch (PR #13).
- **Majors vs. projects:** majors are shown, but projects have no "majors wanted" field, so the app can't judge major fit.
- **Red/green lock-status colouring:** requested, but the scope wasn't confirmed.

## Bugs fixed along the way

- The solver only tried spawning `python`, not `python3`. It now tries both.
- The minimum-3200 default inconsistency from the Diego merge (see above).

## Files changed

| File | What changed |
|---|---|
| `prisma/schema.prisma` + migration | `locked` field on team memberships |
| `server/services/CPSAT/team_generator.py` | 3200-only suggestion solver; main solver respects locks and the min/max 3200 range, with specific infeasibility errors |
| `server/services/CPSAT/ortools.ts` | Passes config through; python3/python fix |
| `server/services/CPSAT/test_locking.py`, `test_minimum_3200.py` | Diego's regression tests |
| `server/services/membershipService.ts` | Typed `locked` field |
| `server/api/team-formation/lock.post.ts` | Place/lock one student (`locked`, default true); `replaceLocked` (default false) lets a board move replace a locked placement |
| `server/api/team-formation/lock.delete.ts` | Unlock one student (clears the lock, keeps the placement) |
| `server/api/team-formation/lock-team.post.ts` | Lock/unlock a whole team |
| `server/api/team-formation/suggest-locks.post.ts` | 3200-only suggestion solve |
| `server/api/team-formation/generate.post.ts` | Skips locked students, keeps their placements, passes 3200 caps |
| `app/pages/team-formation.vue` | All UI: the steps, step 3 locking, the Arrange Teams board, Improve, compare and swap |
| `BRANCH_SETUP.md` | Setup steps for this branch |

## How it was verified

There's no test runner for the UI. The solver changes are covered by `test.ts` and Diego's unittest files. The page was tested by hand in the running app against **Fall 2026 test data** (fake `f26wtest`/`f26ttest` student IDs), covering the step gating, saved-bids summary, folded step 3, Lock all/Unlock all, Improve, moves, and compare and swap. The data was checked to be unchanged afterwards, and Spring 2026's real locked data was not touched. `nuxi typecheck` isn't available in this repo (no `vue-tsc`), so templates were checked by compiling the page with `@vue/compiler-sfc`.
