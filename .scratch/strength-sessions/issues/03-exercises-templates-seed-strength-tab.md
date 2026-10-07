# 03: Exercises, templates and seed, plus the Strength tab

**What to build:** A fifth Strength tab in the bottom bar lists templates. Exercises (measure of reps with optional weight, or timed hold; per-side flag; note; rest time) and templates (name, kind gym or physio, ordered slots with sets, rep range or hold seconds, rest time, superset groups) exist in the data model. An idempotent strength seed script creates the exercises and four templates from the spec: Gym A, Gym B, Physio: ankle, Physio: hips and core. Each template can be opened to read its exercises, targets, notes and supersets.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Migration adds exercises, templates and template slots
- [ ] Strength tab appears and lists the four seeded templates, each with a gym or physio kind
- [ ] Opening a template shows its exercises, sets, rep ranges or hold times, notes and superset groups as in the spec's seed data
- [ ] Exercise names are unique, matched case-insensitively ignoring surrounding whitespace
- [ ] Single-leg calf raise is one shared exercise used by Gym B and Physio: ankle
- [ ] Re-running the seed creates no duplicates
- [ ] Strength module tests cover exercise-name matching
