#!/bin/sh
# Checks that server/utils/skillFit.ts (used by the tie-break report) gives the same TF-IDF numbers
# as server/services/CPSAT/skill_match.py (used by the solver). Run from the repo root (Node 22+).
set -e
node --experimental-strip-types --no-warnings scripts/skills-baseline/parity.mts
