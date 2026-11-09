# Team Formation Changes — What's New

What the **Team Formation** page does on this branch (`dadrean/team-integration`). Read this and `BRANCH_SETUP.md` (same folder) before working on this code. The full page description is section 4 of `docs/design/ui.md`.

## The problem this solves

Staff wanted to place certain 3200 students into teams *before* running the main algorithm on everyone else, so a returning student or a student with special circumstances can be locked into the right team first. That grew into a full workflow: generate, lock the teams you like, regenerate for the rest, and fix individual students by hand, always with each student's preferences in view.

## Skills tie-break (Oct 28, 2026)

When several students want an over-subscribed project, ties are now settled in this order, and **never ahead of a
real choice score**:

1. Has been in 3200 before.
2. More semesters in EPICS.
3. **Skill fit** between the student's bid-form skills and the project's new **Skills (tie-break)** field
   (Database → Projects). Empty skills on either side means no signal.

- Skill fit is a local TF-IDF cosine (`server/services/CPSAT/skill_match.py`, same method as
  `scripts/skills-baseline/tfidf.py`). Fixed rules, no network, same data gives the same answer.
- **Optional LLM scoring (off by default).** Set `SKILL_TIEBREAK_PROVIDER=gemini` and `GEMINI_API_KEY` (model via
  `GEMINI_MODEL`) to have Gemini score only students competing for an over-subscribed project (top 3 choices), using
  the shared 0-3 rubric from the benchmark. It only replaces the TF-IDF number inside level 3; it cannot move anyone
  off their choices. If any call for a project fails, that project falls back to TF-IDF for everyone. Per request,
  `skillProvider` in the body of `generate` / `suggest-locks` does the same. Jev is not wired in yet.
- **Bug fixed:** `ortools.ts` listed the fields it sent to Python and left out `priorSemesters` /
  `prior3200Semesters`, so the experience tie-break never reached the solver. It does now.
- `SCORE_SCALE` went from 100,000 to 10,000,000 to leave room for the finer tie-break points.
- Run `npx prisma migrate deploy` then `npx prisma generate` (new `Project.skills` column).
- Tests: `cd server/services/CPSAT && python3 -m unittest test_skill_match test_tie_break` (the second needs
  `ortools`).

### Tie-breaks report, unplaced students, Gemini switch

- **Tie-breaks button** (Manage Teams toolbar, next to Not top 3). Opens a read-only report
  (`GET /api/team-formation/tie-breaks`, component `app/components/TieBreakModal.vue`):
  - A project is *contested* when more students ranked it in their top N (1-4, default 3) than a team can hold.
  - For each contested project, students are listed in tie-break order: higher pick, 3200 before 2200, done 3200
    before, more semesters, then skill fit. The last column says why each student is ahead of the next, and a badge
    shows who the board actually has on that project (the solver also weighs everyone's other picks, so the board
    can differ from this order).
  - **Export CSV** saves the whole report.
  - Second tab, **No team yet**: students on this day who aren't on any team (name, class, first pick or "No bid",
    skills). This answers the old "board doesn't show students with no team" gap in a list, not on the board.
- **Skill tie-break switch** (⚙ → Rules → Skill tie-break). Turns the optional Gemini scoring on for Regenerate and
  the 3200 suggestions. Disabled unless the server has `GEMINI_API_KEY`. Off by default.
- `server/utils/skillFit.ts` is a TypeScript copy of the Python TF-IDF so the report shows the same numbers as the
  solver. `sh scripts/skills-baseline/check_parity.sh` (Node 22, run from the repo root) checks they agree.
- Still not built: Jev scoring, and showing tie-break reasons on the team cards themselves.

## Latest changes (Oct 27, 2026)

If you only read one section, read this one. Setup steps after pulling are in `BRANCH_SETUP.md`: in short, run
`npx prisma migrate deploy` and then `npx prisma generate`.

- **Fits on one screen.** Manage Teams uses the full width with shorter cards (6 per row on a laptop), so a 16-team
  day fits without scrolling while the Workbench is empty.
- **Not top 3 filter.** A toolbar button, next to 3200, that shows how many students aren't on one of their top 3
  picks. When on, cards list only those students.
- **Warnings on cards.** A team that's too small, too big, or short on 3200s (against the ⚙ settings) gets amber
  numbers and a ⚠. The heading says how many teams need a look.
- **Final versions.** **Make final** puts a version on the board and locks every team, so they all become projects.
  **Not final** puts back the locks the version was saved with. Only one final version per day.
- **Export.** It works any time, but until the day is final it asks first and names the file `… (draft).csv`. Every
  row has a `Locked` column. **Bug fixed:** it used to include students from other semesters on the same project,
  so re-export any team file made before this date.
- **Phones.** Below 640px wide the side rails become a top bar (steps) and a bottom bar (Back/Next), and cards go
  one per row. ⓘ tips now open on tap as well as hover.
- **Confirm dialogs.** No empty band, buttons on the right, and the main button's colour matches the action (red
  only for destructive ones). This applies to every confirm in the app.
- **The page keeps your place in the URL** (`?semester=…&step=…&day=…&bench=…`), so a refresh comes back to the
  same view.

## The page now

Three steps, **Semester → Bid Files → Manage Teams**, with the steps on a left rail and Next/Back on a right rail.
`docs/design/ui.md` section 4 describes every part of it; this is the short version.

1. **Semester:** a table of semesters with each day's status (`3 projects · 9 teams · 70 students`). Select opens
   Bid Files first, on purpose, so staff check the files before working on teams.
2. **Bid Files:** one row per day with the saved file (open it to see the CSV), Replace, or a drop box. A day still
   waiting for its file sorts on top. Students with no bid are placed by major (rule-based).
3. **Manage Teams:** teams build on their own the first time a day is opened. Then:
   - **Toolbar:** Search (⌘K), the 3200 view, Not top 3, Version, and ⚙ (team size, 3200 range, light extras,
     the Lock 3200s tab, and Regenerate).
   - **Workbench:** click a card to bring it up. Drag or swap students, Improve, and lock a single student or the
     whole team. Click a student to see their preferences and spotlight the teams they ranked.
   - **All teams:** every other team as a card with rank badges, the padlock, Improve, and any ⚠.
   - **Words:** a fully locked team is a **project**; one still being worked on is a **team**.
   - **Versions:** saved automatically before a regenerate or going back, or by hand. Go back, Make final,
     Not final, delete.

## Design rule: computed, not AI

Placement help must be **computed with fixed, explainable rules, not decided by AI**. Improve and the swap warnings are deterministic, rank-based rules with no external calls: the same data always gives the same answer. Don't add AI or LLM-based placement or recommendations without asking the team first. The optional Gemini skill score (see Skills tie-break) is the one exception being proposed: advisory, tie-break level only, off by default. **Confirm the team is OK with it before turning it on.**

## The Diego merge

Diego's branch added a parallel implementation of the "minimum 3200" idea (`min_3200_per_team`) plus a separate locking mechanism (locks passed on every solve call via `locked_student_assignments`/`locked_teams`, instead of being saved in the database). When the branches were merged:

- Only `min_upperclass_per_project` is connected to the UI. Diego's separate `min_3200_per_team` field did not survive.
- Diego's lock-passing mechanism is still in `team_generator.py` but unused: the app uses the database-backed `Membership.locked`. It has its own regression tests (`test_locking.py`).
- A merge bug left the minimum-3200 default inconsistent between the solver, the UI and `test.ts`. Diego's `test_minimum_3200.py` shows the default of 1 is intentional, so it's 1 everywhere now. `test.ts`, `test_minimum_3200.py` and `test_locking.py` all pass.

## How to use it

1. **Semester:** click the semester in the table. It opens Bid Files.
2. **Bid Files:** check each day's file, or upload one if a day has none. Then Next.
3. **Manage Teams:** pick Wednesday or Thursday on the Working on bar. Teams build on their own the first time.
4. Use **Not top 3** and the ⚠ warnings to find teams to fix. Click a card to bring it up to the Workbench, then
   move or swap students, or use Improve. Lock students or teams you're done with.
5. To re-solve everyone who isn't locked, use ⚙ → **Regenerate**. The board before it is saved as a version.
6. When the day is done, open **Version** and click **Make final** on the version you're going with, then
   **Export**.

## What's still open

- **Major-fit switch (waiting for the sponsor).** `team_generator.py` always adds a bonus for a major that fits the
  project type. Whether that gets an on/off switch under ⚙ Light extras is up to the sponsor. Don't build it until
  that's decided.
- **Text-response skill matching:** using students' free-text answers to break ties for a contested spot. Aniketh is
  researching this (comparing cosine similarity with other approaches). It has to stay rule-based (see the design
  rule).
- **Scale change for oversubscribed choices:** weighting lower-ranked choices more when a student's top picks are
  full, for both 2200 and 3200 students. Same piece of work as the item above.
- **Students with no team yet:** the board doesn't show them, but Tie-breaks → No team yet lists them.
- **Dragging on phones:** the browser's drag and drop doesn't work on touch, so on a phone, students are moved by
  tapping two of them and confirming the swap.
- **Tie-break on prior experience** (3200 first, then more semesters) now reaches the solver (it was being dropped
  before), but still does nothing on the current data, because every student has only one enrollment.
- **Project skills are empty** until someone fills the Skills field on each project by hand; until then skill fit
  contributes nothing.

## Bugs fixed along the way

- The solver only tried spawning `python`, not `python3`. It now tries both.
- The minimum-3200 default inconsistency from the Diego merge (see above).
- Team Export included other semesters' students on the same project (Oct 27, 2026).
- The page crashed on a refresh during server render, because version history was fetched without the login
  cookie. It now uses `useRequestFetch()`.

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
| `prisma/schema.prisma` + migrations `add_bid_file`, `add_team_version`, `add_team_version_final` | Saved bid files, team versions, and the final flag |
| `server/services/teamVersionService.ts` | Save, list, describe, restore, delete, make final / not final |
| `server/api/team-formation/versions*.ts`, `versions/*.ts` | Version routes, including `versions/final.post.ts` |
| `server/api/team-formation/bids.post.ts`, `bid-file.get.ts`, `server/utils/noBid.ts` | Bid import, saved file viewer, no-bid placement |
| `server/utils/priorExperience.ts` | Tie-break by 3200 experience, then semesters |
| `app/pages/team-formation.vue` | All UI: the three steps, Manage Teams board, versions, filters, warnings, export |
| `app/components/InfoTip.vue`, `BidDayUpload.vue` | ⓘ tips (hover and tap); bid file rows |
| `app/components/modals/ConfirmationModal.vue`, `ModalFooter.vue`, `app/composables/useConfirm.ts` | Confirm dialog layout and button colour |
| `docs/design/ui.md` | Section 4 describes the current page |
| `BRANCH_SETUP.md` | Setup steps for this branch |

## How it was verified

There's no test runner for the UI. The solver changes are covered by `test.ts` and Diego's unittest files. The page was tested by hand in the running app against **Fall 2026 test data** (fake `f26wtest`/`f26ttest` student IDs), covering the step gating, saved-bids summary, folded step 3, Lock all/Unlock all, Improve, moves, and compare and swap. The data was checked to be unchanged afterwards, and Spring 2026's real locked data was not touched. `nuxi typecheck` isn't available in this repo (no `vue-tsc`), so templates were checked by compiling the page with `@vue/compiler-sfc`.

The Oct 27, 2026 changes were checked in Chrome on Fall 2026 Wednesday: page height against the window, the Not top
3 count against the cards, warnings by raising the ⚙ limits on screen only (never regenerating), a 390px-wide
frame for phones, and the export file's rows against the database team by team. The final-version paths were
clicked through by hand.

### Gemini skill tie-break, finished (Oct 28, 2026)
- **Turn it on:** put `GEMINI_API_KEY=...` in `.env`, restart `pnpm dev`, then ⚙ → Rules → Skill tie-break → switch on
  "Score skills with Gemini". Off by default. Optional `GEMINI_MODEL` (default `gemini-3.5-flash`; Google retired
  `gemini-2.5-flash` in Oct 2026).
- **Test Gemini button** (same ⚙ section): one tiny real call. Says whether the key works and, if not, why
  (bad key, wrong model name, quota). `POST /api/team-formation/gemini-test`; never returns the key.
- **Visible result:** after Regenerate or Suggest, a "Skill tie-break" notice says how many students Gemini scored,
  or that it fell back to the built-in TF-IDF score and why. It can no longer fall back silently.
- **Tie-breaks report now follows the switch:** with Gemini on, the Skill fit column shows Gemini's 0-1 rating
  for contested projects (the same numbers the solver uses) and is labelled "(Gemini)". CSV header matches.
- Still advisory: last tie-break level only, only for contested projects, never moves anyone off their picks.
  If a call fails for a project, nobody on that project gets a Gemini score (no mixing Gemini and TF-IDF).
  Team sign-off still needed before it is turned on for real placements.

### Step 4: Finalize (Oct 28, 2026)
A fourth step in the Team Formation rail, after Manage Teams. It is the sign-off screen for one meeting day
(Wednesday/Thursday switch at the top) and is read-only except for Make final / Not final.
- **Status banner and progress bar:** "Ready to finalize", "N things to fix first" or "Final: Version N".
- **Readiness checklist:** every student has a team; team sizes within the ⚙ min/max; every team has the required 3200s;
  every team has a mentor; nearly everyone on a top-3 pick; teams locked; board saved as a version; marked final.
  Red = blocks sign-off, amber = worth a look. Uses the same rules as the Manage Teams card warnings.
- **Headline numbers:** students placed, % on a top-3 pick, % on their 1st pick, team count and average size.
  No-bid students (placed by the importer) are shown separately and left out of the percentages.
- **Pick distribution bar** (1st / 2nd / 3rd / 4th or lower / no bid), **team table** (size, 3200s, top-3 picks, mentor,
  lock and warnings, with a "Needs a look" filter), and two lists: **No team yet** and **Not on a top-3 pick**.
- **Make Version N final** saves the board as a version first if needed (so it is always undoable), then uses the
  existing final-version logic (locks every team). **Not final** puts the earlier locks back.
- **Share:** Export teams (the existing CSV, marked draft until final), Team summary (CSV, one row per team),
  Copy summary (plain text for an email), Print (side rails are hidden when printing).
- Next on Manage Teams now waits until at least one team has students ("Build teams first.").
- Files: `app/components/FinalizeStep.vue`, `server/api/team-formation/finalize-summary.get.ts`, small edits in
  `app/pages/team-formation.vue`. No database changes, no new packages.
