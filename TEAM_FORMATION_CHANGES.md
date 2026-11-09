# Team Formation Changes — What's New

Everything added to the **Team Formation** page on the `3200-team-lock` branch, pushed to the shared repo. This file + `BRANCH_SETUP.md` (same folder) are the handoff: read both before touching this code in a new session.

## The problem this solves

Staff wanted to place certain 3200 students into teams *before* running the main algorithm on everyone else — so a returning student, or a student with special circumstances, can be locked into the right team first, and the algorithm only has to figure out everyone else around them. This grew into a full iterative workflow: generate, lock the teams you like, regenerate for the rest, repeat — plus the ability to manually fix individual students after the fact.

**Two contributors on this branch:** this session (Claude, working with the repo owner) and a teammate, Diego Valle, who independently built the minimum-3200-per-team requirement and a separate solver-lock mechanism. Those were merged in — see "The Diego merge" section below for what that actually involved and what got reconciled.

## What was built

### 1. Lock a student into a team manually

Section **"3. Lock 3200 Students"** lists every 3200 student for the selected semester/day with their ranked project choices. Pick a team from the dropdown, hit **Lock** — that student is placed immediately and skipped by the algorithm from then on. **Unlock** clears the lock and leaves the student on that team as an ordinary member, so the next Generate Teams can move them. Locking a student who already has an unlocked placement (e.g. from a prior Generate Teams run) correctly replaces it instead of erroring.

### 2. Let the algorithm suggest placements first

**"Suggest Placements"** runs the algorithm on just the unlocked 3200 students:
- Guarantees each student their **1st or 2nd choice** whenever possible, falling back to **3rd choice** only if capacity genuinely requires it (clearly flagged when it happens)
- Sets aside any student who **never submitted a bid**, instead of letting them block everyone else

Each suggestion pre-fills the team dropdown and explains why. Review, adjust anything that looks wrong, then lock individually or hit **"Lock All Suggested"**.

### 3. Live, honest labeling everywhere you look

- The reason text updates live as you change the dropdown.
- The dropdown is ordered by that student's own ranking, with their returning project (if any) flagged right in the list.
- Note: "returning" only activates once there's real multi-semester history in the database — Spring 2026 is currently the only semester with saved data.

### 4. Min/max 3200-per-project range

One combined control in section 3: **Min 3200 per Project** / **Max 3200 per Project**, both respected by **Suggest Placements** *and* **Generate Teams**.

- **Max** defaults to 4 — stops one popular project absorbing all the 3200s.
- **Min** defaults to **1** (every project needs at least one 3200) — this is Diego's intentional design (see below), not something this session chose. It's tight by nature; if there genuinely aren't enough 3200 students, it fails with a specific error telling you exactly how many more are needed, rather than failing silently.

### 5. Optional choice-rank display, and a 3200 badge, in the final results

A checkbox (off by default) shows each student's choice rank next to their name. A small "3200" badge is always visible on 3200 students in the results.

### 6. Lock a whole team and re-run the algorithm on the rest — iterative mode

Every team, in the always-visible team list *and* in the generated results, has a **Lock Team / Unlock Team** button. Locking a team locks every current member at once. Hit **Generate Teams** again and locked members stay put (same database rows) while everyone else re-solves. A locked team with spare seats can still receive new students. Repeat as many rounds as needed.

### 7. Move a student to a different team after results are in

Each student in the generated results has a **Move** button. Opens a panel showing their **major** and **full ranked choices** (so you can judge whether the move actually helps them), a team dropdown sorted by their own preferences, and a **"Lock in new team"** checkbox. Left unchecked by default — the move stays fully flexible, a future Generate Teams run (or another manual move) can still touch that student freely.

### 8. Pin teams

A bookmark icon on every team, in both the always-visible list and the results. **Purely visual** — doesn't touch the algorithm or the database on its own. Lets staff flag "I'm considering this one" before committing. A **"Lock All Pinned"** button appears once anything's pinned, to commit to all of them in one click.

### 9. Step-by-step page layout

Every section header is clickable; only one section's body is open at a time, and it auto-advances as you complete each step (pick a semester → bid upload opens; upload succeeds → lock section opens). Nothing is ever permanently hidden — click any header to jump back to it.

## The Diego merge

Diego's branch added a parallel implementation of the same "minimum 3200" idea (`min_3200_per_team`, a separate UI field) plus a from-scratch locking mechanism (locks passed fresh on every solve call via `locked_student_assignments`/`locked_teams`, instead of being saved in the database). When the branches were merged:

- Diego's separate `min_3200_per_team` field and UI block did **not** survive — only this session's `min_upperclass_per_project` mechanism remains connected to anything.
- Diego's ephemeral lock-passing mechanism is still present in `team_generator.py` (dormant — nothing in this app's actual UI/API populates those config keys, since this session's DB-backed `Membership.locked` approach is what the app actually uses). It's untested-by-use but has its own regression tests (`test_locking.py`).
- **Real bug found and fixed:** the merge left the minimum-3200 default inconsistent between the Python solver, the UI's default value, and a hardcoded assumption in the shared `test.ts` regression script. Investigated thoroughly, confirmed Diego's own test suite (`test_minimum_3200.py`) proves the default-of-1 behavior was *intentional* on his part (not an accident), and reconciled everything to that: default is 1 everywhere now, consistently. Verified by running `test.ts`, `test_minimum_3200.py`, and `test_locking.py` together — all green.

**Worth raising with Diego:** the default-of-1 is tight (needs roughly one 3200 student per team) — same caveat flagged to the repo owner earlier applies to his design too.

## How to use it, step by step

1. Go to **Team Formation**, pick a **Semester** and **Meeting Day**
2. (Optional) Upload a bid CSV if this semester/day hasn't been imported yet
3. In section 3, hit **Suggest Placements** — review each suggested team + reason, adjust for any that look wrong
4. Hit **Lock All Suggested** (or lock individuals one at a time)
5. In section 4, set your min/max 3200 range, hit **Generate Teams**
6. Review the results — lock or pin whole teams you're happy with, move individual students if something looks off
7. Hit **Generate Teams** again to re-solve just the rest — repeat as needed

## What's still open / not built yet

- **Text-response skill matching** — using students' free-text experience answers to help break ties between students competing for the same spot. Not built; this is also the real fix for arbitrary tie-breaking when two students score identically for one contested spot.
- **Scale change for oversubscribed choices** — boosting the weight of lower-ranked choices when a student's top picks are already full. Applies to both 2200 and 3200 students; not built. (Same backlog item as the tie-break fix above — they're one piece of work.)
- **Fall 2026 data** — no real student-ID roster exists for that semester yet.
- **Bidless students** (never submitted a bid at all) — not addressed; needs a decision on manual-add UI vs. documentation-only approach, and whether assignment-by-major is automatic or staff-picked.
- **Red/green lock-status coloring** — a UI polish request from the repo owner's team lead, not yet built, and scope (individual-student locks only, or everywhere locking shows up) wasn't confirmed before work moved to other priorities.

Full detail on these, plus a live/editable list either of you can add to, is in the backlog tool described below.

## Bugs fixed along the way (not new features, but worth knowing)

- The solver only ever tried spawning `python`, not `python3` — fixed to try both.
- `ortools` wasn't installed on this machine — installed it.
- Lock Team / Unlock Team only appeared after clicking "Generate Teams" that page load — moved to the always-visible team list.
- The minimum-3200 default inconsistency from the Diego merge (see above).

## Files changed (for reference)

| File | What changed |
|---|---|
| `prisma/schema.prisma` + migration | Added a `locked` field to team memberships |
| `server/services/CPSAT/team_generator.py` | 3200-only suggestion solver; main solver respects locked students, min/max 3200-per-project, Diego's dormant lock-passing mechanism, specific infeasibility errors |
| `server/services/CPSAT/ortools.ts` | Wires through config/caps; python3-vs-python fix |
| `server/services/CPSAT/test_locking.py`, `test_minimum_3200.py` | Diego's regression tests (both passing) |
| `server/services/membershipService.ts` | Typed the new `locked` field |
| `server/api/team-formation/lock.post.ts` | Lock/unlock one student; now also used for the flexible "Move" feature (`locked` param, defaults true) |
| `server/api/team-formation/lock.delete.ts` | Unlock one student |
| `server/api/team-formation/lock-team.post.ts` | Bulk lock/unlock a whole team (also powers "Lock All Pinned") |
| `server/api/team-formation/suggest-locks.post.ts` | Runs the 3200-only suggestion solve |
| `server/api/team-formation/generate.post.ts` | Skips locked students, preserves placements, passes through 3200 caps |
| `app/pages/team-formation.vue` | All UI: lock/suggest section, lock-team controls, move panel, pin feature, step-by-step accordion |
| `BRANCH_SETUP.md` | Setup steps for anyone pulling this branch fresh |

## How everything was verified

No test runner existed in this repo before Diego added unittest-based ones for his pieces. This session's verification: synthetic solver tests for each new constraint, the full-scale `test.ts` re-run after every solver change, and repeated real end-to-end runs against the actual Spring 2026 roster through the live app (signed in via the dev-mode OTP logged to console) — including creating isolated throwaway test students for the Move feature, confirming correct behavior, then fully deleting them. Real locked data from independent testing (by the repo owner) was identified and left untouched throughout.
