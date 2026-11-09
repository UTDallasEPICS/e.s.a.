# Team Generation Algorithm

This document describes the team-assignment algorithm as implemented, spanning
`server/api/team-formation/generate.post.ts` (data prep, invocation, persistence) and
`server/services/CPSAT/team_generator.py` (the CP-SAT model itself, run via
`server/services/CPSAT/ortools.ts`).

The algorithm is a single constraint-satisfaction/optimization pass: given a semester + meeting day, it assigns
every eligible student to exactly one active project team in one solve, subject to hard constraints, and maximizing
a weighted objective built from soft-constraint bonuses and penalties. There is no post-processing step afterward —
the solver's hard constraints already guarantee a complete, size-valid assignment for every solution it returns; if
no such assignment exists, the solver reports infeasible and the request fails with a 400 rather than falling back
to heuristic placement.

---

## Table of contents

1. [Core and Configurable Goals](#1-core-and-configurable-goals)
2. [Hard Constraints](#2-hard-constraints)
3. [Soft Constraints](#3-soft-constraints)
4. [Bonus/Penalty Table](#4-bonuspenalty-table)

---

## 1. Core and Configurable Goals

**Core goal (always on, not configurable):** every non-mentor student enrolled in the semester + day being solved
is assigned to exactly one of that day's active project teams, with team sizes kept within bounds, maximizing
overall preference satisfaction across the whole cohort — not any single student's outcome.

**Configurable goals**, passed as `CPSATConfig` in the request body (`generate.post.ts` §`config`) and defaulted in
both `ortools.ts` and `team_generator.py` if omitted:

| Field                          | Default | Effect                                                                                     |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `min_team_size`                 | `4`     | Hard lower bound on every team's size (§2)                                                   |
| `max_team_size`                 | `6`     | Hard upper bound on every team's size (§2)                                                   |
| `min_upperclass_per_project`             | `1`     | Hard minimum number of EPCS 3200 students on every team; `0` disables this rule. Must be a non-negative integer no greater than `max_team_size`. |
| `prioritize_returning_students` | `true`  | Enables the returning-student bonus (§3)                                                     |
| `prioritize_3200_first_choice`  | `true`  | Enables the EPCS 3200 scoring multiplier (§3) — the name is legacy; it isn't first-choice-only, see §3 note |
| `balance_gender`                | `true`  | Enables the gender-isolation penalty (§3)                                                    |

`min_team_size`, `max_team_size`, and `min_upperclass_per_project` change what counts as a *valid* solution; the other three
only reweight the objective among otherwise-valid solutions.

---

## 2. Hard Constraints

The generation endpoint excludes students with locked memberships from solver inputs.
Their project's `locked_count` and `locked_upperclass_count` reserve capacity and count
toward team-size and 3200 requirements. Generation replaces only unlocked memberships,
then includes the preserved locked students in its response. The page supports individual
and bulk team-member locks backed by the database. Bulk locking preserves current members
but does not prevent additional students joining a team with spare capacity.

Run the locking tests with:
`PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s server/services/CPSAT -p test_locking.py`.

Enforced directly in the CP-SAT model (`team_generator.py`); violating any of these makes the model infeasible,
which surfaces to the caller as a 400 with a diagnostic message (`generate.post.ts` catches the rejected promise
from `generateTeamsORTools`).

| # | Constraint                    | Model detail                                                                                                    |
| - | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1 | One project per student        | `sum(x[s][p] for all p) == 1` for every student `s` — every student is assigned somewhere, including students with no valid choices (they simply score 0 against every project). |
| 2 | Team size bounds               | `min_team_size <= sum(x[s][p] for all s) <= max_team_size` for every project `p`.                                  |
| 3 | Returning students must be 3200 | Input validation, not a model constraint: raises before solving if any student has `previousProject` set but `class != '3200'`. |
| 4 | Meeting-day match               | If both the student and the project have a `day`, `x[s][p]` is forced to 0 for every non-matching pair.            |
| 5 | Minimum EPCS 3200 students      | Every team must contain at least `min_upperclass_per_project` students whose class is `3200`, regardless of preference priority settings. Insufficient 3200 enrollment rejects generation before assignments are saved. |

Only eligible (non-mentor) students enrolled for that semester+day, and only projects with an active `Team` for
that semester+day, are given to the solver at all (`generate.post.ts`) — day filtering there and constraint 4 are
redundant by construction today, but constraint 4 stays as a defense against future callers that don't pre-filter.

---

## 3. Soft Constraints

Everything below only affects the objective (`model.Maximize(sum(objective_terms))`), never feasibility. All are
summed per student-project pair `x[s][p]`, so a term with weight 0 for a given pair simply contributes nothing.

- **Preference score** — always on. Score depends on the pair's rank in the student's choice list (§4).
- **3200 scoring multiplier** (`prioritize_3200_first_choice`) — multiplies the preference score, not just for the
  student's literal first choice, but for *any* choice of a 3200-level student (see note in §4).
- **Returning-student bonus** (`prioritize_returning_students`) — multiplies the preference score again when the
  project is the student's most recent prior-semester project. Only ever applies to 3200 students, and only when
  that prior project is still one of their current choices (`generate.post.ts` computes `previousProject` under
  that constraint before the student even reaches the Python side).
- **Gender-balance penalty** (`balance_gender`) — penalizes a team where exactly one student of a given gender
  (`Male` or `Female`) would be isolated.
- **Major/project-type adjacency bonus** — always on. Rewards assigning students to projects that match their
  major's software/hardware adjacency.

---

## 4. Bonus/Penalty Table

**Preference-rank base score** (by index in the student's ranked choice list; a project not in the student's
choices scores 0 from this term):

| Rank        | Base score |
| ----------- | ---------- |
| 1st choice  | 1000       |
| 2nd choice  | 500        |
| 3rd choice  | 200        |
| 4th choice  | 100        |
| 5th choice  | 50         |
| 6th choice  | 25         |
| 7th+ / unranked | 0      |

**Multipliers**, applied on top of the base score above, in order, only for pairs where the project is in the
student's choices:

| Modifier                        | Factor | Condition                                                                                          |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| 3200 scoring multiplier          | ×100   | `student.class == '3200'` and `config.prioritize_3200_first_choice` — applies to every choice the student ranked, not only rank 1. |
| Returning-student bonus          | ×1.5   | `config.prioritize_returning_students`, student has a `previousProject`, and `previousProject == p_name`. |

**Flat bonuses/penalties**, added independently of preference rank:

| Term                          | Value | Condition                                                                 |
| ------------------------------ | ----- | ---------------------------------------------------------------------------- |
| Gender isolation penalty (male)   | −500  | `config.balance_gender` and exactly 1 male student assigned to the team.     |
| Gender isolation penalty (female) | −500  | `config.balance_gender` and exactly 1 female student assigned to the team.   |
| "Both"-type project bonus         | +80   | Project's `type == 'Both'` — applies to every student, regardless of major.  |
| SW-project major-fit bonus        | +60   | Project's `type == 'SW'` and student's major is `CS`, `SE`, or `DS`.         |
| HW-project major-fit bonus        | +60   | Project's `type == 'HW'` and student's major is `EE`, `ME`, `BME`, or `CE`.  |
