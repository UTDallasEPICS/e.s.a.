# Running this branch (3200-team-lock)

If you already have the project running, here's what's different for this branch.

## What's new

- Lock individual 3200 students, or let the algorithm suggest placements (guarantees 1st or 2nd choice whenever possible)
- Lock a whole team and rerun the algorithm on just what's left, as many rounds as you want
- Min/max settings for how many 3200 students can land on one project

## Setup steps

1. **Get the branch**
   ```bash
   git fetch origin
   git checkout 3200-team-lock
   ```

2. **Make sure Python's solver library is installed**
   ```bash
   pip install ortools
   ```

3. **Update your database** (adds one new field, doesn't touch your existing data)
   ```bash
   npx prisma migrate dev
   ```

4. **Run it like normal**
   ```bash
   pnpm dev
   ```

Make sure `node -v` says `v22.x` before running it.

Everything else works the same as before.
