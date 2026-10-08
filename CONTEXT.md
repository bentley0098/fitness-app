# Adaptive Training

A single-user training app that plans runs and strength work, tracks what was actually done, and lets an LLM propose changes that the runner approves.

## Language

### Plan

**Planned session**:
A workout scheduled on a date in the plan, which may be a run or a strength session.
_Avoid_: Workout, event

**Proposal**:
A set of changes an LLM suggests to the plan, which takes effect only when the runner approves it in the app.
_Avoid_: Suggestion, draft

**Activity**:
A workout recorded by the Garmin watch and synced in, used to judge whether a planned session was done.
_Avoid_: Workout, log

**Today**:
The runner's current calendar date in their own timezone, which follows their device and falls back to Irish time when no device is involved. Every date in the app is a plain calendar date, and an activity's date is the one the watch recorded locally.
_Avoid_: Now, current date

### Strength

**Strength session**:
A planned or ad-hoc session of exercises, of kind gym or physio. It can be scheduled on a date or started on the spot with no plan.
_Avoid_: Lifting session, gym session (gym is only a kind)

**Kind**:
The label on a strength session, either gym or physio, used for filtering and display rather than to change behaviour.
_Avoid_: Type (reserved for run session types)

**Gym**:
The kind of strength session done at a gym, usually with weights.

**Physio**:
The kind of strength session done at home, usually bodyweight, bands or holds, in the style of rehab exercises.
_Avoid_: Home session, rehab

**Template**:
A reusable, named, ordered list of exercises with target sets and reps (or hold time) but no target weight, which a strength session is started from. Weight always comes from the last logged set.
_Avoid_: Routine, programme

**Exercise**:
A named movement with a stable identity, so its history can be followed across sessions and templates. It declares how it is measured.
_Avoid_: Movement, lift

**Measure**:
How an exercise is counted: reps with an optional weight (blank for bodyweight), or a timed hold. An exercise can also be per side, in which case one logged number applies to each side.
_Avoid_: Mode, unit

**Superset**:
Two or more consecutive exercises in a template whose sets are done alternately, one set of each in turn, before resting.
_Avoid_: Circuit, pair

**Set**:
One logged effort at an exercise, recording reps and weight, or reps only, or a hold duration, according to the exercise's measure.
_Avoid_: Round

**Strength log**:
The runner's own record of the sets done in a strength session. It is the source of truth for reps and weights, and the watch's strength data does not override it.
_Avoid_: History, tracking
